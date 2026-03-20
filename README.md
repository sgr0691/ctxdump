# ctxdump

> Export AI chat context from any tool into clean, portable markdown.

---

## Why

Switching between tools like Codex, Claude, and Cursor sucks when you lose context.

`ctxdump` lets you export your full session instantly.

---

## Install

### npm
```bash
npm install -g ctxdump
```

### Bun
```bash
bun add -g ctxdump
```

Or run without installing:

### npx
```bash
npx ctxdump codex
```

### bunx
```bash
bunx ctxdump codex
```

---

## Usage

### Export latest session
```bash
ctxdump codex --latest
```

### Search sessions
```bash
ctxdump codex "search term"
```

---

## Output

Generates:

```
context.md
```

Includes:
- system prompts
- user messages
- assistant responses
- tool calls (if available)

---

## Roadmap

- [ ] Claude support
- [ ] Cursor support
- [ ] ChatGPT export
- [ ] JSON output
- [ ] Pipe between tools

---

## Tech

- Bun
- TypeScript
- Crust (CLI framework)

---

## Contributing

PRs welcome. Keep it simple.

---

## License

MIT
