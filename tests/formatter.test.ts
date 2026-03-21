import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { parseCodexFile } from "../src/adapters/codex/parser.ts";
import { normalizeCodexSession } from "../src/adapters/codex/normalize.ts";
import { formatMarkdown } from "../src/formatters/markdown.ts";
import { formatJson } from "../src/formatters/json.ts";
import type { SessionRef } from "../src/types.ts";

const FIXTURES = join(import.meta.dirname, "fixtures/codex");

function makeRef(id: string, path: string): SessionRef {
  return { id, path, source: "codex" };
}

function getContext(fixture: string) {
  const path = join(FIXTURES, fixture);
  const parsed = parseCodexFile(path);
  const ref = makeRef("test-id", path);
  return normalizeCodexSession(parsed, ref);
}

describe("formatMarkdown", () => {
  it("produces a markdown string with a heading", () => {
    const ctx = getContext("minimal.jsonl");
    const md = formatMarkdown(ctx);

    expect(md).toContain("# ");
    expect(md).toContain("**User**");
    expect(md).toContain("**Assistant**");
  });

  it("includes session metadata", () => {
    const ctx = getContext("minimal.jsonl");
    const md = formatMarkdown(ctx);

    expect(md).toContain("**Source:**");
    expect(md).toContain("codex");
  });

  it("includes tool calls by default", () => {
    const ctx = getContext("with-tools.jsonl");
    const md = formatMarkdown(ctx, { includeTools: true });

    expect(md).toContain("shell");
  });

  it("omits tool messages when includeTools is false", () => {
    const ctx = getContext("with-tools.jsonl");
    const md = formatMarkdown(ctx, { includeTools: false });

    // Tool Output section should not appear
    expect(md).not.toContain("**Tool Output**");
  });

  it("includes files section when files exist", () => {
    const ctx = getContext("with-tools.jsonl");
    const md = formatMarkdown(ctx, { includeFiles: true });

    expect(md).toContain("Files Referenced");
    expect(md).toContain("package.json");
  });

  it("omits files section when includeFiles is false", () => {
    const ctx = getContext("with-tools.jsonl");
    const md = formatMarkdown(ctx, { includeFiles: false });

    expect(md).not.toContain("## Files Referenced");
  });

  it("is deterministic — same output on multiple calls", () => {
    const ctx = getContext("minimal.jsonl");
    expect(formatMarkdown(ctx)).toBe(formatMarkdown(ctx));
  });

  it("ends with a newline", () => {
    const ctx = getContext("minimal.jsonl");
    expect(formatMarkdown(ctx).endsWith("\n")).toBe(true);
  });
});

describe("formatJson", () => {
  it("produces valid JSON", () => {
    const ctx = getContext("minimal.jsonl");
    const json = formatJson(ctx);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("includes required schema fields", () => {
    const ctx = getContext("minimal.jsonl");
    const parsed = JSON.parse(formatJson(ctx));

    expect(parsed.schemaVersion).toBe("1");
    expect(parsed.source).toBe("codex");
    expect(Array.isArray(parsed.messages)).toBe(true);
  });

  it("omits tool calls when includeTools is false", () => {
    const ctx = getContext("with-tools.jsonl");
    const parsed = JSON.parse(formatJson(ctx, { includeTools: false }));

    expect(parsed.toolCalls).toBeUndefined();
    const toolMessages = parsed.messages.filter(
      (m: { role: string }) => m.role === "tool",
    );
    expect(toolMessages).toHaveLength(0);
  });

  it("omits files when includeFiles is false", () => {
    const ctx = getContext("with-tools.jsonl");
    const parsed = JSON.parse(formatJson(ctx, { includeFiles: false }));

    expect(parsed.files).toBeUndefined();
  });

  it("is deterministic", () => {
    const ctx = getContext("minimal.jsonl");
    expect(formatJson(ctx)).toBe(formatJson(ctx));
  });

  it("ends with a newline", () => {
    const ctx = getContext("minimal.jsonl");
    expect(formatJson(ctx).endsWith("\n")).toBe(true);
  });
});
