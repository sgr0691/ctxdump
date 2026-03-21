import { Crust } from "@crustjs/core";
import {
  resolveCodexSessionsDir,
  getLatestCodexSession,
  findCodexSessionByQuery,
  getCodexSessionByPath,
  parseCodexFile,
  normalizeCodexSession,
} from "../adapters/codex/index.ts";
import { formatMarkdown } from "../formatters/markdown.ts";
import { formatJson } from "../formatters/json.ts";
import { writeToFile, writeToStdout, writeToClipboard } from "../output/index.ts";
import { CtxDumpError, formatErrorForCLI } from "../errors.ts";
import type { OutputFormat } from "../types.ts";

export const codexCommand = new Crust("codex")
  .meta({ description: "Export sessions from OpenAI Codex CLI (~/.codex/sessions)" })
  .args([
    {
      name: "query",
      type: "string",
      description: "Search query to find a session by content",
      optional: true,
    } as const,
  ])
  .flags({
    latest: {
      type: "boolean",
      description: "Export the most recent session",
      short: "l",
    },
    path: {
      type: "string",
      description: "Explicit path to a session .jsonl file",
      short: "p",
    },
    format: {
      type: "string",
      description: "Output format: markdown (default) or json",
      short: "f",
    },
    out: {
      type: "string",
      description: "Write output to this file path",
      short: "o",
    },
    stdout: {
      type: "boolean",
      description: "Print to stdout",
    },
    copy: {
      type: "boolean",
      description: "Copy output to clipboard",
      short: "c",
    },
    tools: {
      type: "boolean",
      description: "Include tool calls in output (default: true)",
    },
    files: {
      type: "boolean",
      description: "Include file references in output (default: true)",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging",
      short: "v",
    },
    quiet: {
      type: "boolean",
      description: "Suppress success messages",
      short: "q",
    },
  })
  .run(async ({ args, flags }) => {
    const verbose = flags.verbose ?? false;
    const quiet = flags.quiet ?? false;

    function log(msg: string) {
      if (!quiet) console.error(msg);
    }

    function debug(msg: string) {
      if (verbose) console.error(`[verbose] ${msg}`);
    }

    try {
      // 1. Resolve session ref
      let sessionsDir: string | undefined;
      try {
        sessionsDir = resolveCodexSessionsDir();
      } catch (err) {
        if (!(err instanceof CtxDumpError) || err.code !== "DISCOVERY_FAILED") {
          throw err;
        }
        // Discovery error is only fatal if we don't have an explicit path
        if (!flags.path) {
          throw err;
        }
      }

      let ref;
      if (flags.path) {
        debug(`Using explicit path: ${flags.path}`);
        ref = getCodexSessionByPath(flags.path);
      } else if (flags.latest) {
        debug("Selecting latest session");
        ref = getLatestCodexSession(sessionsDir!);
      } else if (args.query) {
        debug(`Searching for session: ${args.query}`);
        ref = findCodexSessionByQuery(sessionsDir!, args.query);
      } else {
        // Default to latest
        debug("No selection flag provided — defaulting to --latest");
        ref = getLatestCodexSession(sessionsDir!);
      }

      debug(`Session path: ${ref.path}`);

      // 2. Parse and normalize
      const parsed = parseCodexFile(ref.path);
      debug(
        `Parsed ${parsed.responseItems.length} response items, ` +
          `${parsed.eventMsgs.length} event messages`,
      );

      const ctx = normalizeCodexSession(parsed, ref);
      debug(`Normalized: ${ctx.messages.length} messages, title: "${ctx.title}"`);

      // 3. Format
      const format = (flags.format as OutputFormat | undefined) ?? "markdown";
      if (format !== "markdown" && format !== "json") {
        throw new CtxDumpError(
          "OUTPUT_FAILED",
          `Unknown format "${format}". Valid values: markdown, json`,
        );
      }

      // --tools / --files default to true unless explicitly set to false
      const includeTools = flags.tools !== false;
      const includeFiles = flags.files !== false;

      const content =
        format === "json"
          ? formatJson(ctx, { includeTools, includeFiles })
          : formatMarkdown(ctx, { includeTools, includeFiles });

      // 4. Output
      if (flags.copy) {
        await writeToClipboard(content);
        log(`✓ Copied to clipboard (${ctx.title})`);
      }

      if (flags.stdout) {
        writeToStdout(content);
      } else if (flags.out) {
        writeToFile(flags.out, content);
        log(`✓ Written to ${flags.out}`);
      } else if (!flags.copy) {
        // Default: write to context.md (or context.json)
        const defaultOut = format === "json" ? "context.json" : "context.md";
        writeToFile(defaultOut, content);
        log(`✓ Written to ${defaultOut} (${ctx.title})`);
      }
    } catch (err) {
      console.error(`Error: ${formatErrorForCLI(err)}`);
      process.exitCode = 1;
    }
  });
