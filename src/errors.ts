export type CtxDumpErrorCode =
  | "DISCOVERY_FAILED"
  | "SESSION_NOT_FOUND"
  | "PARSE_FAILED"
  | "NORMALIZE_FAILED"
  | "OUTPUT_FAILED"
  | "UNSUPPORTED_SOURCE"
  | "INVALID_PATH";

export class CtxDumpError extends Error {
  constructor(
    public readonly code: CtxDumpErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CtxDumpError";
  }
}

export function formatErrorForCLI(err: unknown): string {
  if (err instanceof CtxDumpError) {
    return `[${err.code}] ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
