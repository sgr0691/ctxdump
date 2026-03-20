import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { parseCodexFile } from "../src/adapters/codex/parser.ts";
import { normalizeCodexSession } from "../src/adapters/codex/normalize.ts";
import type { SessionRef } from "../src/types.ts";

const FIXTURES = join(import.meta.dirname, "fixtures/codex");

function makeRef(id: string, path: string): SessionRef {
  return { id, path, source: "codex" };
}

describe("normalizeCodexSession", () => {
  it("normalizes a minimal session correctly", () => {
    const path = join(FIXTURES, "minimal.jsonl");
    const parsed = parseCodexFile(path);
    const ref = makeRef("5973b6c0-94b8-487b-a530-2aeb6098ae0e", path);
    const ctx = normalizeCodexSession(parsed, ref);

    expect(ctx.schemaVersion).toBe("1");
    expect(ctx.source).toBe("codex");
    expect(ctx.sessionId).toBe("5973b6c0-94b8-487b-a530-2aeb6098ae0e");
    expect(ctx.cwd).toBe("/home/user/project");
    expect(ctx.model).toBe("gpt-4o");
    expect(ctx.messages).toHaveLength(2);
    expect(ctx.messages[0]).toMatchObject({ role: "user", content: "Why is my Redis client timing out?" });
    expect(ctx.messages[1]!.role).toBe("assistant");
  });

  it("infers a title from the first user message", () => {
    const path = join(FIXTURES, "minimal.jsonl");
    const parsed = parseCodexFile(path);
    const ref = makeRef("abc", path);
    const ctx = normalizeCodexSession(parsed, ref);

    expect(ctx.title).toBe("Why is my Redis client timing out?");
  });

  it("normalizes tool calls from shell commands", () => {
    const path = join(FIXTURES, "with-tools.jsonl");
    const parsed = parseCodexFile(path);
    const ref = makeRef("aabbccdd-1234-5678-abcd-ef0123456789", path);
    const ctx = normalizeCodexSession(parsed, ref);

    expect(ctx.toolCalls).toBeDefined();
    expect(ctx.toolCalls!.length).toBeGreaterThan(0);
    expect(ctx.toolCalls![0]).toMatchObject({ name: "shell" });
    expect(ctx.toolCalls![0]!.output).toContain("express");
  });

  it("normalizes function calls", () => {
    const path = join(FIXTURES, "with-function-calls.jsonl");
    const parsed = parseCodexFile(path);
    const ref = makeRef("deadbeef-cafe-1234-5678-000000000001", path);
    const ctx = normalizeCodexSession(parsed, ref);

    expect(ctx.toolCalls).toBeDefined();
    const createFile = ctx.toolCalls!.find((t) => t.name === "create_file");
    expect(createFile).toBeDefined();
    expect(createFile!.args).toContain("hello.txt");
    expect(createFile!.output).toContain("successfully");
  });

  it("extracts file references from shell commands", () => {
    const path = join(FIXTURES, "with-tools.jsonl");
    const parsed = parseCodexFile(path);
    const ref = makeRef("aabbccdd-1234-5678-abcd-ef0123456789", path);
    const ctx = normalizeCodexSession(parsed, ref);

    expect(ctx.files).toBeDefined();
    expect(ctx.files!.some((f) => f.path === "package.json")).toBe(true);
  });

  it("handles malformed input gracefully", () => {
    const path = join(FIXTURES, "malformed.jsonl");
    const parsed = parseCodexFile(path);
    const ref = makeRef("bad-session-0000", path);

    // Should not throw
    const ctx = normalizeCodexSession(parsed, ref);
    expect(ctx.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to a generated title if no user messages exist", () => {
    const path = join(FIXTURES, "minimal.jsonl");
    const parsed = parseCodexFile(path);
    // Remove all messages
    const emptyParsed = { ...parsed, responseItems: [] };
    const ref = makeRef("test-id-1234", path);
    const ctx = normalizeCodexSession(emptyParsed, ref);

    expect(ctx.title).toMatch(/Session|test-id/);
  });
});
