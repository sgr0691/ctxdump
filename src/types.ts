/**
 * Core normalized types for ctxdump.
 * These form the stable schema that all adapters normalize into.
 */

export const SCHEMA_VERSION = "1";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface NormalizedMessage {
  role: MessageRole;
  content: string;
  /** ISO 8601 timestamp, if available */
  timestamp?: string;
  /** Tool call name if this is a tool result or tool call */
  toolName?: string;
  /** Raw tool call arguments (stringified JSON) */
  toolArgs?: string;
  /** Tool call output/result */
  toolOutput?: string;
}

export interface NormalizedFileRef {
  path: string;
  /** "read" | "write" | "create" | "delete" | unknown */
  operation?: string;
}

export interface NormalizedToolCall {
  name: string;
  args: string;
  output?: string;
  timestamp?: string;
}

/**
 * The canonical normalized context schema.
 * All adapters produce this shape.
 */
export interface NormalizedContext {
  schemaVersion: string;
  /** Source adapter name, e.g. "codex" */
  source: string;
  /** Best-effort session identifier */
  sessionId?: string;
  /** Best-effort title derived from source or first user message */
  title?: string;
  /** ISO 8601 */
  createdAt?: string;
  /** ISO 8601 */
  updatedAt?: string;
  /** Working directory at session start, if available */
  cwd?: string;
  /** Model name used in the session */
  model?: string;
  messages: NormalizedMessage[];
  files?: NormalizedFileRef[];
  toolCalls?: NormalizedToolCall[];
  metadata: Record<string, unknown>;
}

/**
 * A lightweight reference to a session found on disk,
 * used for discovery and selection.
 */
export interface SessionRef {
  id: string;
  path: string;
  /** Best-effort title */
  title?: string;
  /** ISO 8601 */
  createdAt?: string;
  /** ISO 8601 */
  updatedAt?: string;
  source: string;
}

export type OutputFormat = "markdown" | "json";
