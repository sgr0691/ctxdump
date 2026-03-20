import { existsSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type { SessionRef } from "../../types.ts";
import { CtxDumpError } from "../../errors.ts";

const SOURCE = "codex";

/** Resolve the root sessions directory for Codex. */
export function resolveCodexSessionsDir(override?: string): string {
  if (override) {
    if (!existsSync(override)) {
      throw new CtxDumpError(
        "INVALID_PATH",
        `Specified path does not exist: ${override}`,
      );
    }
    return override;
  }

  const envHome = process.env["CODEX_HOME"];
  const base = envHome ?? join(homedir(), ".codex");
  const sessionsDir = join(base, "sessions");

  if (!existsSync(sessionsDir)) {
    throw new CtxDumpError(
      "DISCOVERY_FAILED",
      `Codex sessions directory not found at ${sessionsDir}. ` +
        `Run \`codex\` at least once to create it, or set CODEX_HOME.`,
    );
  }

  return sessionsDir;
}

/**
 * Parse timestamp from a rollout filename like:
 * rollout-2025-05-07T17-24-21-<uuid>.jsonl
 */
function parseTimestampFromFilename(filename: string): string | undefined {
  // Match: rollout-YYYY-MM-DDTHH-MM-SS-...
  const match = filename.match(
    /rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/,
  );
  if (!match || !match[1]) return undefined;
  // Convert T17-24-21 → T17:24:21
  return match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3") + "Z";
}

/** Parse session ID (UUID portion) from rollout filename. */
function parseIdFromFilename(filename: string): string {
  // Strip rollout- prefix and .jsonl suffix
  const name = filename.replace(/^rollout-/, "").replace(/\.jsonl$/, "");
  // UUID is typically after the timestamp portion
  const parts = name.split("-");
  // If we can find a UUID-like segment (8-4-4-4-12), use from there
  // Otherwise fall back to the whole stripped name
  for (let i = 0; i < parts.length; i++) {
    const candidate = parts.slice(i).join("-");
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        candidate,
      )
    ) {
      return candidate;
    }
  }
  return name;
}

/**
 * Recursively enumerate all rollout JSONL files under sessionsDir.
 * Codex shards sessions into YYYY/MM/DD subdirectories.
 */
function collectJsonlFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...collectJsonlFiles(full));
      } else if (entry.endsWith(".jsonl") && entry.startsWith("rollout-")) {
        results.push(full);
      }
    }
  } catch {
    // Ignore unreadable subdirs
  }
  return results;
}

/** List all Codex sessions sorted by most recent first. */
export function listCodexSessions(sessionsDir: string): SessionRef[] {
  const files = collectJsonlFiles(sessionsDir);

  const refs: SessionRef[] = files.map((filePath) => {
    const filename = basename(filePath);
    const id = parseIdFromFilename(filename);
    const createdAt = parseTimestampFromFilename(filename);

    let updatedAt: string | undefined;
    try {
      const stat = statSync(filePath);
      updatedAt = stat.mtime.toISOString();
    } catch {
      updatedAt = createdAt;
    }

    return {
      id,
      path: filePath,
      source: SOURCE,
      createdAt,
      updatedAt,
    };
  });

  // Sort newest first by updatedAt, then createdAt
  refs.sort((a, b) => {
    const ta = a.updatedAt ?? a.createdAt ?? "";
    const tb = b.updatedAt ?? b.createdAt ?? "";
    return tb.localeCompare(ta);
  });

  return refs;
}

/** Return the latest Codex session. */
export function getLatestCodexSession(sessionsDir: string): SessionRef {
  const sessions = listCodexSessions(sessionsDir);
  if (sessions.length === 0) {
    throw new CtxDumpError(
      "SESSION_NOT_FOUND",
      `No Codex sessions found in ${sessionsDir}.`,
    );
  }
  const latest = sessions[0];
  if (!latest) {
    throw new CtxDumpError("SESSION_NOT_FOUND", "No sessions found.");
  }
  return latest;
}

/** Find a session by search query (case-insensitive content match on title). */
export function findCodexSessionByQuery(
  sessionsDir: string,
  query: string,
): SessionRef {
  const sessions = listCodexSessions(sessionsDir);
  if (sessions.length === 0) {
    throw new CtxDumpError(
      "SESSION_NOT_FOUND",
      `No Codex sessions found in ${sessionsDir}.`,
    );
  }

  const lower = query.toLowerCase();

  // Try title match first
  const titleMatch = sessions.find(
    (s) => s.title && s.title.toLowerCase().includes(lower),
  );
  if (titleMatch) return titleMatch;

  // Fall back to filename/id match
  const idMatch = sessions.find(
    (s) =>
      s.id.toLowerCase().includes(lower) ||
      s.path.toLowerCase().includes(lower),
  );
  if (idMatch) return idMatch;

  throw new CtxDumpError(
    "SESSION_NOT_FOUND",
    `No Codex session matching "${query}" found in ${sessionsDir}.`,
  );
}

/** Return a session ref for an explicit file path. */
export function getCodexSessionByPath(filePath: string): SessionRef {
  if (!existsSync(filePath)) {
    throw new CtxDumpError(
      "INVALID_PATH",
      `Session file not found: ${filePath}`,
    );
  }

  const filename = basename(filePath);
  const id = parseIdFromFilename(filename);
  const createdAt = parseTimestampFromFilename(filename);

  let updatedAt: string | undefined;
  try {
    const stat = statSync(filePath);
    updatedAt = stat.mtime.toISOString();
  } catch {
    updatedAt = createdAt;
  }

  return {
    id,
    path: filePath,
    source: SOURCE,
    createdAt,
    updatedAt,
  };
}
