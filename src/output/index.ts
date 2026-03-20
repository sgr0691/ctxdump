import { writeFileSync } from "node:fs";
import { CtxDumpError } from "../errors.ts";

/** Write content to a file. */
export function writeToFile(filePath: string, content: string): void {
  try {
    writeFileSync(filePath, content, "utf-8");
  } catch (err) {
    throw new CtxDumpError(
      "OUTPUT_FAILED",
      `Could not write to file: ${filePath}`,
      err,
    );
  }
}

/** Write content to stdout. */
export function writeToStdout(content: string): void {
  process.stdout.write(content);
}

/** Copy content to the system clipboard. */
export async function writeToClipboard(content: string): Promise<void> {
  const { platform } = process;

  let cmd: string;
  let args: string[];

  if (platform === "darwin") {
    cmd = "pbcopy";
    args = [];
  } else if (platform === "linux") {
    // Try xclip, then xsel, then wl-copy (Wayland)
    cmd = "xclip";
    args = ["-selection", "clipboard"];
  } else if (platform === "win32") {
    cmd = "clip";
    args = [];
  } else {
    throw new CtxDumpError(
      "OUTPUT_FAILED",
      `Clipboard copy is not supported on platform: ${platform}`,
    );
  }

  try {
    const proc = Bun.spawn([cmd, ...args], {
      stdin: "pipe",
    });
    proc.stdin.write(content);
    proc.stdin.end();
    await proc.exited;

    if (proc.exitCode !== 0) {
      // Try fallback on Linux
      if (platform === "linux" && cmd === "xclip") {
        await writeToClipboardLinuxFallback(content);
        return;
      }
      throw new Error(`Process exited with code ${proc.exitCode}`);
    }
  } catch (err) {
    if (platform === "linux" && cmd === "xclip") {
      await writeToClipboardLinuxFallback(content);
      return;
    }
    throw new CtxDumpError(
      "OUTPUT_FAILED",
      `Failed to copy to clipboard. Make sure \`${cmd}\` is installed.`,
      err,
    );
  }
}

async function writeToClipboardLinuxFallback(content: string): Promise<void> {
  // Try xsel
  try {
    const proc = Bun.spawn(["xsel", "--clipboard", "--input"], {
      stdin: "pipe",
    });
    proc.stdin.write(content);
    proc.stdin.end();
    await proc.exited;
    if (proc.exitCode === 0) return;
  } catch {
    // Try wl-copy (Wayland)
  }

  try {
    const proc = Bun.spawn(["wl-copy"], { stdin: "pipe" });
    proc.stdin.write(content);
    proc.stdin.end();
    await proc.exited;
    if (proc.exitCode === 0) return;
  } catch {
    // Nothing worked
  }

  throw new CtxDumpError(
    "OUTPUT_FAILED",
    "Failed to copy to clipboard. Install `xclip`, `xsel`, or `wl-copy`.",
  );
}
