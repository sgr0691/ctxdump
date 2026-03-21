import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { parseCodexFile } from "../src/adapters/codex/parser.ts";

const FIXTURES = join(import.meta.dirname, "fixtures/codex");

describe("parseCodexFile", () => {
  it("parses a minimal session", () => {
    const result = parseCodexFile(join(FIXTURES, "minimal.jsonl"));

    expect(result.sessionMeta).toBeDefined();
    expect(result.sessionMeta!.id).toBe("5973b6c0-94b8-487b-a530-2aeb6098ae0e");
    expect(result.sessionMeta!.cwd).toBe("/home/user/project");
    expect(result.sessionMeta!.model_provider).toBe("gpt-4o");

    expect(result.responseItems).toHaveLength(2);
    expect(result.responseItems[0]).toMatchObject({ type: "message", role: "user" });
    expect(result.responseItems[1]).toMatchObject({ type: "message", role: "assistant" });
  });

  it("parses a session with shell tool calls", () => {
    const result = parseCodexFile(join(FIXTURES, "with-tools.jsonl"));

    expect(result.sessionMeta!.id).toBe("aabbccdd-1234-5678-abcd-ef0123456789");
    expect(result.responseItems).toHaveLength(4);

    const shellCall = result.responseItems[1];
    expect(shellCall).toBeDefined();
    expect(shellCall!.type).toBe("local_shell_call");

    const shellOutput = result.responseItems[2];
    expect(shellOutput).toBeDefined();
    expect(shellOutput!.type).toBe("local_shell_call_output");
  });

  it("parses a session with function calls", () => {
    const result = parseCodexFile(join(FIXTURES, "with-function-calls.jsonl"));

    const fnCall = result.responseItems.find((r) => r.type === "function_call");
    expect(fnCall).toBeDefined();
    expect((fnCall as { type: string; name?: string }).name).toBe("create_file");

    const fnOutput = result.responseItems.find((r) => r.type === "function_call_output");
    expect(fnOutput).toBeDefined();
  });

  it("skips malformed lines without throwing", () => {
    const result = parseCodexFile(join(FIXTURES, "malformed.jsonl"));

    // Should still parse the valid lines
    expect(result.sessionMeta).toBeDefined();
    expect(result.responseItems.length).toBeGreaterThanOrEqual(2);
  });

  it("throws PARSE_FAILED for a nonexistent file", () => {
    expect(() => parseCodexFile("/nonexistent/path/to/file.jsonl")).toThrow(
      expect.objectContaining({ code: "PARSE_FAILED" }),
    );
  });
});
