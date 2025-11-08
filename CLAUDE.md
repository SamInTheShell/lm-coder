This project is a plugin for LM Studio using `@lmstudio/sdk`

# Writing Tools

This is what a tool looks like:

```typescript
import { tool, Tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { existsSync } from "fs";
import { writeFile } from "fs/promises";

export const getCreateFileTool = (ctl: ToolsProviderController) => {
  return tool({
    name: "createFile",
    description: "Create a file with the given name and content.",
    parameters: { name: z.string(), content: z.string() },
    implementation: async ({ name, content }) => {
      const config = ctl.getPluginConfig(configSchematics);
      if (existsSync(name)) {
        return "Error: File already exists.";
      }
      await writeFile(name, content, "utf-8");
      return "File created.";
    },
  });
};
```

Tools should be saved in `src/tools/`.

They should be added to `toolsProvider.ts` to be used when the plugin is loaded.
