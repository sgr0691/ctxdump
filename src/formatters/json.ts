import type { NormalizedContext } from "../types.ts";

export function formatJson(
  ctx: NormalizedContext,
  opts: { includeTools?: boolean; includeFiles?: boolean } = {},
): string {
  const includeTools = opts.includeTools ?? true;
  const includeFiles = opts.includeFiles ?? true;

  const output: NormalizedContext = {
    ...ctx,
    messages: includeTools
      ? ctx.messages
      : ctx.messages.filter((m) => m.role !== "tool" && !m.toolName),
    toolCalls: includeTools ? ctx.toolCalls : undefined,
    files: includeFiles ? ctx.files : undefined,
  };

  return JSON.stringify(output, null, 2) + "\n";
}
