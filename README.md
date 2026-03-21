# ctxdump

> Export AI chat context from local LLM tools into clean, portable markdown or JSON.

---

## Why

Switching between Codex, Claude, and Cursor means losing context. `ctxdump` exports your full session instantly — local-first, no cloud, deterministic output.

---

## Install

### Bun
```bash
bun add -g ctxdump
```

### npm
```bash
npm install -g ctxdump
```

Or run without installing:

```bash
bunx ctxdump codex --latest
npx ctxdump codex --latest
```

---

## Usage

### Export latest Codex session
```bash
ctxdump codex --latest
# → writes context.md
```

### Search sessions by content
```bash
ctxdump codex "redis timeout"
```

### Export to a specific file
```bash
ctxdump codex --latest --out session.md
```

### Export as JSON
```bash
ctxdump codex --latest --format json
```

### Print to stdout
```bash
ctxdump codex --latest --stdout
```

### Copy to clipboard
```bash
ctxdump codex --latest --copy
```

### Use an explicit session file path
```bash
ctxdump codex --path ~/.codex/sessions/2025/05/07/rollout-abc123.jsonl
```

### Exclude tool calls from output
```bash
ctxdump codex --latest --tools false
```

---

## Output

By default, writes `context.md` (or `context.json` with `--format json`).

Each export includes:
- Session metadata (source, ID, timestamps, working directory, model)
- Full conversation (user → assistant turns)
- Tool calls (shell commands, function calls) — included by default
- File references — included by default

---

## Supported Sources

| Source | Status |
|--------|--------|
| Codex  | ✅ Supported |
| Cursor | 🗓 Planned (v1) |
| Claude Desktop | 🗓 Planned (v1) |

Sessions are read from `~/.codex/sessions/` by default. Set `CODEX_HOME` to override.

---

## Flags

```
--latest, -l        Export the most recent session
--path, -p          Explicit path to a session .jsonl file
--format, -f        Output format: markdown (default) or json
--out, -o           Write output to this file path
--stdout            Print to stdout
--copy, -c          Copy output to clipboard
--tools             Include tool calls (default: true)
--files             Include file references (default: true)
--verbose, -v       Enable verbose logging
--quiet, -q         Suppress success messages
```

---

## Privacy

`ctxdump` is local-first. Your session data never leaves your machine. No network requests are made during export.

---

## Tech

- [Bun](https://bun.sh) runtime
- TypeScript
- [Crust](https://crustjs.com) CLI framework

---

## Roadmap

- [x] Codex adapter
- [ ] Cursor adapter (v1)
- [ ] Claude Desktop adapter (v1)
- [ ] `--skill compact` (v1)
- [ ] Interactive session picker (v1)
- [ ] AI-powered summarization (v2)
- [ ] MCP server mode (v2)

---

## Contributing

PRs welcome. Keep it simple.

---

## License

MIT
