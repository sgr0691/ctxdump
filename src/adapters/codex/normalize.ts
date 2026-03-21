import type { ParsedCodexSession, RawResponseItem, RawContentItem } from "./parser.ts";
import type {
  NormalizedContext,
  NormalizedMessage,
  NormalizedFileRef,
  NormalizedToolCall,
  MessageRole,
} from "../../types.ts";
import { SCHEMA_VERSION } from "../../types.ts";
import type { SessionRef } from "../../types.ts";

const SOURCE = "codex";

function extractTextFromContent(content: RawContentItem[]): string {
  return content
    .map((item) => {
      if (item.type === "output_text" || item.type === "input_text") {
        return item.text ?? "";
      }
      if (item.type === "text") {
        return item.text ?? "";
      }
      if (item.type === "thinking") {
        return item.text ? `<thinking>\n${item.text}\n</thinking>` : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeRole(role: string): MessageRole {
  switch (role.toLowerCase()) {
    case "user":
      return "user";
    case "assistant":
      return "assistant";
    case "system":
      return "system";
    case "tool":
      return "tool";
    default:
      return "assistant";
  }
}

function inferTitle(messages: NormalizedMessage[], sessionId?: string): string {
  // Find first user message with content
  for (const msg of messages) {
    if (msg.role === "user" && msg.content.trim().length > 0) {
      const first = msg.content.trim().slice(0, 80);
      return first.includes("\n") ? first.split("\n")[0]!.trim() : first;
    }
  }
  if (sessionId) {
    return `Session ${sessionId.slice(0, 8)}`;
  }
  return "Untitled Session";
}

/** Detect file references from shell commands and tool calls. */
function extractFileRefs(
  items: RawResponseItem[],
): NormalizedFileRef[] {
  const seen = new Set<string>();
  const refs: NormalizedFileRef[] = [];

  function addRef(path: string, operation?: string) {
    const key = `${operation ?? ""}:${path}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ path, operation });
    }
  }

  for (const item of items) {
    if (item.type === "local_shell_call") {
      const shellItem = item as { type: "local_shell_call"; action?: { command?: string[] } };
      const cmd = shellItem.action?.command;
      if (Array.isArray(cmd)) {
        // Heuristic: look for file-like args (contains / or .)
        for (const arg of cmd) {
          if (
            typeof arg === "string" &&
            (arg.includes("/") || arg.includes(".")) &&
            !arg.startsWith("-") &&
            arg.length > 2
          ) {
            addRef(arg, inferFileOperation(cmd[0]));
          }
        }
      }
    }

    if (item.type === "function_call") {
      const fnItem = item as { type: "function_call"; name?: string; arguments?: string };
      const name = fnItem.name ?? "";
      if (fnItem.arguments) {
        try {
          const args = JSON.parse(fnItem.arguments) as Record<string, unknown>;
          // Common file-related argument names
          for (const key of ["path", "file_path", "filename", "filepath"]) {
            const val = args[key];
            if (typeof val === "string" && val.length > 0) {
              addRef(val, inferFileOperationFromFnName(name));
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return refs;
}

function inferFileOperation(cmd?: string): string | undefined {
  if (!cmd) return undefined;
  const base = cmd.split("/").pop()?.toLowerCase() ?? cmd.toLowerCase();
  if (["cat", "head", "tail", "less", "more", "view"].includes(base)) return "read";
  if (["write", "echo", "tee", "cp", "mv"].includes(base)) return "write";
  if (["rm", "unlink", "rmdir"].includes(base)) return "delete";
  if (["touch", "mkdir", "create"].includes(base)) return "create";
  return undefined;
}

function inferFileOperationFromFnName(name: string): string | undefined {
  const lower = name.toLowerCase();
  if (lower.includes("read") || lower.includes("view") || lower.includes("get")) return "read";
  if (lower.includes("write") || lower.includes("create") || lower.includes("edit") || lower.includes("update")) return "write";
  if (lower.includes("delete") || lower.includes("remove")) return "delete";
  return undefined;
}

function extractToolCalls(
  items: RawResponseItem[],
  rawLines: Array<{ timestamp?: string; type: string; payload: unknown }>,
): NormalizedToolCall[] {
  const toolCalls: NormalizedToolCall[] = [];
  const outputsByCallId = new Map<string, string>();

  // First pass: collect outputs
  for (const item of items) {
    if (item.type === "local_shell_call_output") {
      const out = item as { type: string; call_id?: string; output?: { output?: string } };
      if (out.call_id && out.output?.output) {
        outputsByCallId.set(out.call_id, out.output.output);
      }
    }
    if (item.type === "function_call_output") {
      const out = item as { type: string; call_id?: string; output?: string };
      if (out.call_id && out.output) {
        outputsByCallId.set(out.call_id, out.output);
      }
    }
  }

  // Second pass: collect calls with matched outputs
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const rawLine = rawLines[i];
    const timestamp = rawLine?.timestamp;

    if (item.type === "local_shell_call") {
      const shell = item as { type: string; call_id?: string; action?: { command?: string[] } };
      const cmd = shell.action?.command;
      const name = Array.isArray(cmd) ? cmd.join(" ") : "shell";
      const callId = shell.call_id;
      toolCalls.push({
        name: "shell",
        args: name,
        output: callId ? outputsByCallId.get(callId) : undefined,
        timestamp,
      });
    }

    if (item.type === "function_call") {
      const fn = item as { type: string; name?: string; arguments?: string; call_id?: string };
      toolCalls.push({
        name: fn.name ?? "unknown",
        args: fn.arguments ?? "{}",
        output: fn.call_id ? outputsByCallId.get(fn.call_id) : undefined,
        timestamp,
      });
    }
  }

  return toolCalls;
}

/** Normalize a parsed Codex session into the canonical schema. */
export function normalizeCodexSession(
  parsed: ParsedCodexSession,
  ref: SessionRef,
): NormalizedContext {
  const { sessionMeta, responseItems, rawLines } = parsed;

  const messages: NormalizedMessage[] = [];

  for (let i = 0; i < responseItems.length; i++) {
    const item = responseItems[i]!;
    const rawLine = rawLines[i];
    const timestamp = rawLine?.timestamp;

    if (item.type === "message") {
      const msgItem = item as { type: "message"; role: string; content: RawContentItem[] };
      const content = extractTextFromContent(msgItem.content ?? []);
      if (content.trim()) {
        messages.push({
          role: normalizeRole(msgItem.role),
          content,
          timestamp,
        });
      }
    } else if (item.type === "reasoning") {
      const reasoning = item as { type: "reasoning"; summary?: Array<{ type: string; text?: string }> };
      const parts = (reasoning.summary ?? [])
        .map((s) => s.text ?? "")
        .filter(Boolean);
      if (parts.length > 0) {
        messages.push({
          role: "assistant",
          content: parts.join("\n"),
          timestamp,
        });
      }
    } else if (item.type === "local_shell_call") {
      const shell = item as { type: string; action?: { command?: string[] } };
      const cmd = Array.isArray(shell.action?.command)
        ? shell.action!.command!.join(" ")
        : "shell command";
      messages.push({
        role: "assistant",
        content: `\`\`\`shell\n${cmd}\n\`\`\``,
        toolName: "shell",
        toolArgs: cmd,
        timestamp,
      });
    } else if (item.type === "local_shell_call_output") {
      const out = item as { type: string; output?: { output?: string } };
      const output = out.output?.output ?? "";
      if (output.trim()) {
        messages.push({
          role: "tool",
          content: output,
          toolName: "shell",
          toolOutput: output,
          timestamp,
        });
      }
    } else if (item.type === "function_call") {
      const fn = item as { type: string; name?: string; arguments?: string };
      messages.push({
        role: "assistant",
        content: `Tool call: ${fn.name ?? "unknown"}(${fn.arguments ?? "{}"})`,
        toolName: fn.name,
        toolArgs: fn.arguments,
        timestamp,
      });
    } else if (item.type === "function_call_output") {
      const out = item as { type: string; output?: string };
      if (out.output?.trim()) {
        messages.push({
          role: "tool",
          content: out.output,
          toolOutput: out.output,
          timestamp,
        });
      }
    }
  }

  const title = inferTitle(messages, ref.id);
  const toolCalls = extractToolCalls(responseItems, rawLines);
  const files = extractFileRefs(responseItems);

  return {
    schemaVersion: SCHEMA_VERSION,
    source: SOURCE,
    sessionId: sessionMeta?.id ?? ref.id,
    title,
    createdAt: sessionMeta?.timestamp ?? ref.createdAt,
    updatedAt: ref.updatedAt,
    cwd: sessionMeta?.cwd?.toString(),
    model: sessionMeta?.model_provider ?? undefined,
    messages,
    files: files.length > 0 ? files : undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    metadata: {
      originator: sessionMeta?.originator,
      cli_version: sessionMeta?.cli_version,
      source: sessionMeta?.source,
      git: (sessionMeta as { git?: unknown } | undefined)?.git,
    },
  };
}
