import { readFileSync } from "node:fs";
import { CtxDumpError } from "../../errors.ts";

/**
 * Raw Codex JSONL types, matching the on-disk format from codex-rs.
 * Each line is a RolloutLine: { timestamp, type, payload }
 */

export interface RawSessionMeta {
  id: string;
  timestamp?: string;
  cwd?: string;
  originator?: string;
  cli_version?: string;
  source?: string;
  model_provider?: string;
  base_instructions?: unknown;
}

export interface RawSessionMetaLine extends RawSessionMeta {
  git?: {
    commit_hash?: string;
    branch?: string;
    repository_url?: string;
  };
}

export interface RawContentItem {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface RawResponseItemMessage {
  type: "message";
  role: string;
  content: RawContentItem[];
  end_turn?: boolean;
  phase?: string;
}

export interface RawResponseItemLocalShellCall {
  type: "local_shell_call";
  call_id?: string;
  status?: string;
  action?: {
    type?: string;
    command?: string[];
    env?: Record<string, string>;
    timeout_ms?: number;
    working_directory?: string;
  };
}

export interface RawResponseItemLocalShellOutput {
  type: "local_shell_call_output";
  call_id?: string;
  output?: {
    output?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface RawResponseItemFunctionCall {
  type: "function_call";
  name?: string;
  namespace?: string;
  arguments?: string;
}

export interface RawResponseItemFunctionCallOutput {
  type: "function_call_output";
  call_id?: string;
  output?: string;
}

export interface RawResponseItemReasoning {
  type: "reasoning";
  summary?: Array<{ type: string; text?: string }>;
}

export type RawResponseItem =
  | RawResponseItemMessage
  | RawResponseItemLocalShellCall
  | RawResponseItemLocalShellOutput
  | RawResponseItemFunctionCall
  | RawResponseItemFunctionCallOutput
  | RawResponseItemReasoning
  | { type: string; [key: string]: unknown };

export interface RawEventMsg {
  [key: string]: unknown;
}

export interface RawRolloutLine {
  timestamp?: string;
  type: "session_meta" | "response_item" | "event_msg" | "compacted" | "turn_context" | string;
  payload: unknown;
}

export interface ParsedCodexSession {
  sessionMeta?: RawSessionMetaLine;
  responseItems: RawResponseItem[];
  eventMsgs: RawEventMsg[];
  rawLines: RawRolloutLine[];
}

/** Read and parse a Codex rollout JSONL file. */
export function parseCodexFile(filePath: string): ParsedCodexSession {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new CtxDumpError(
      "PARSE_FAILED",
      `Could not read session file: ${filePath}`,
      err,
    );
  }

  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const result: ParsedCodexSession = {
    responseItems: [],
    eventMsgs: [],
    rawLines: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let parsed: unknown;
    try {
      parsed = JSON.parse(line!);
    } catch {
      // Skip unparseable lines
      continue;
    }

    if (typeof parsed !== "object" || parsed === null) continue;

    const obj = parsed as Record<string, unknown>;

    // Handle both new envelope format { timestamp, type, payload }
    // and legacy bare format (older Codex versions)
    if ("type" in obj && "payload" in obj) {
      // New envelope format
      const rolloutLine: RawRolloutLine = {
        timestamp: typeof obj["timestamp"] === "string" ? obj["timestamp"] : undefined,
        type: String(obj["type"]),
        payload: obj["payload"],
      };
      result.rawLines.push(rolloutLine);

      switch (rolloutLine.type) {
        case "session_meta":
          result.sessionMeta = rolloutLine.payload as RawSessionMetaLine;
          break;
        case "response_item":
          result.responseItems.push(rolloutLine.payload as RawResponseItem);
          break;
        case "event_msg":
          result.eventMsgs.push(rolloutLine.payload as RawEventMsg);
          break;
        case "compacted": {
          // A compacted item has a message field (string) and optional replacement_history
          const compacted = rolloutLine.payload as { message?: string; replacement_history?: RawResponseItem[] };
          if (compacted.replacement_history && Array.isArray(compacted.replacement_history)) {
            result.responseItems.push(...compacted.replacement_history);
          } else if (typeof compacted.message === "string") {
            // Treat compacted message as an assistant message
            result.responseItems.push({
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: compacted.message }],
            });
          }
          break;
        }
        default:
          break;
      }
    } else if ("role" in obj || ("type" in obj && obj["type"] === "message")) {
      // Legacy bare ResponseItem
      result.responseItems.push(obj as RawResponseItem);
    } else if ("id" in obj && "timestamp" in obj && "cwd" in obj) {
      // Legacy bare SessionMeta
      result.sessionMeta = obj as RawSessionMetaLine;
    }
  }

  return result;
}
