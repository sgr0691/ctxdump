import type { NormalizedContext, NormalizedMessage } from "../types.ts";

function formatTimestamp(ts?: string): string {
  if (!ts) return "";
  try {
    return new Date(ts).toISOString();
  } catch {
    return ts;
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case "user":
      return "**User**";
    case "assistant":
      return "**Assistant**";
    case "system":
      return "**System**";
    case "tool":
      return "**Tool Output**";
    default:
      return `**${role}**`;
  }
}

function renderMessage(
  msg: NormalizedMessage,
  opts: { includeTools: boolean },
): string | null {
  // Skip tool messages if not including tools
  if (!opts.includeTools && (msg.role === "tool" || msg.toolName)) {
    return null;
  }

  const label = roleLabel(msg.role);
  const ts = formatTimestamp(msg.timestamp);
  const header = ts ? `${label} _(${ts})_` : label;
  const body = msg.content.trim();

  return `${header}\n\n${body}`;
}

function renderToolCalls(ctx: NormalizedContext): string {
  if (!ctx.toolCalls || ctx.toolCalls.length === 0) return "";

  const lines: string[] = ["## Tool Calls", ""];

  for (const tc of ctx.toolCalls) {
    const ts = formatTimestamp(tc.timestamp);
    const header = ts ? `### \`${tc.name}\` _(${ts})_` : `### \`${tc.name}\``;
    lines.push(header, "");
    lines.push(`**Arguments:**`);
    lines.push("```json");
    try {
      lines.push(JSON.stringify(JSON.parse(tc.args), null, 2));
    } catch {
      lines.push(tc.args);
    }
    lines.push("```", "");
    if (tc.output) {
      lines.push("**Output:**");
      lines.push("```");
      lines.push(tc.output.slice(0, 2000));
      lines.push("```", "");
    }
  }

  return lines.join("\n");
}

function renderFiles(ctx: NormalizedContext): string {
  if (!ctx.files || ctx.files.length === 0) return "";

  const lines: string[] = ["## Files Referenced", ""];

  for (const f of ctx.files) {
    const op = f.operation ? ` _(${f.operation})_` : "";
    lines.push(`- \`${f.path}\`${op}`);
  }

  return lines.join("\n");
}

export function formatMarkdown(
  ctx: NormalizedContext,
  opts: { includeTools?: boolean; includeFiles?: boolean } = {},
): string {
  const includeTools = opts.includeTools ?? true;
  const includeFiles = opts.includeFiles ?? true;

  const sections: string[] = [];

  // Header
  sections.push(`# ${ctx.title ?? "Session Export"}`);
  sections.push("");

  // Metadata block
  const meta: string[] = [];
  if (ctx.source) meta.push(`**Source:** ${ctx.source}`);
  if (ctx.sessionId) meta.push(`**Session ID:** \`${ctx.sessionId}\``);
  if (ctx.createdAt) meta.push(`**Created:** ${formatTimestamp(ctx.createdAt)}`);
  if (ctx.updatedAt) meta.push(`**Updated:** ${formatTimestamp(ctx.updatedAt)}`);
  if (ctx.cwd) meta.push(`**Working directory:** \`${ctx.cwd}\``);
  if (ctx.model) meta.push(`**Model:** ${ctx.model}`);

  if (meta.length > 0) {
    sections.push(meta.join("  \n"));
    sections.push("");
    sections.push("---");
    sections.push("");
  }

  // Messages
  sections.push("## Conversation");
  sections.push("");

  for (const msg of ctx.messages) {
    const rendered = renderMessage(msg, { includeTools });
    if (rendered) {
      sections.push(rendered);
      sections.push("");
      sections.push("---");
      sections.push("");
    }
  }

  // Tool calls section
  if (includeTools && ctx.toolCalls && ctx.toolCalls.length > 0) {
    sections.push(renderToolCalls(ctx));
    sections.push("");
  }

  // Files section
  if (includeFiles && ctx.files && ctx.files.length > 0) {
    sections.push(renderFiles(ctx));
    sections.push("");
  }

  // Footer
  sections.push("---");
  sections.push("");
  sections.push(
    `_Exported by [ctxdump](https://github.com/sgr0691/ctxdump) — schema v${ctx.schemaVersion}_`,
  );

  return sections.join("\n").trim() + "\n";
}
