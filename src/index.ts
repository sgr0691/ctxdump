#!/usr/bin/env bun
import { Crust } from "@crustjs/core";
import { helpPlugin, versionPlugin } from "@crustjs/plugins";
import { codexCommand } from "./commands/codex.ts";

const app = new Crust("ctxdump")
  .meta({
    description:
      "Export AI chat context from local LLM tools into clean, portable markdown or JSON.",
  })
  .use(versionPlugin("0.1.0"))
  .use(helpPlugin())
  .command(codexCommand);

await app.execute();
