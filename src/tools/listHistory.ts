import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { listChanges, getChangeCount } from "./historyUtils";

export const getListHistoryTool = (ctl: ToolsProviderController) => {
  return tool({
    name: "list_history",
    description: "List the change history for the project. Shows the most recent changes with pagination support.",
    parameters: {
      limit: z.number().default(20).describe("Number of changes to retrieve (default: 20, max: 50)"),
      offset: z.number().default(0).describe("Number of changes to skip for pagination (default: 0)"),
    },
    implementation: async ({ limit, offset }) => {
      const config = ctl.getPluginConfig(configSchematics);
      const projectPath = config.get("projectPath");

      if (!projectPath) {
        return "Error: No project path configured.";
      }

      // Enforce max limit
      const effectiveLimit = Math.min(limit, 50);

      try {
        const changes = await listChanges(projectPath, effectiveLimit, offset);
        const totalCount = await getChangeCount(projectPath);

        if (changes.length === 0) {
          if (offset === 0) {
            return "No change history found.";
          } else {
            return "No more changes found.";
          }
        }

        // Format the output
        const entries = changes.map((change, index) => {
          const date = new Date(change.timestamp);
          const formattedDate = date.toLocaleString();
          const filesStr = change.files.join(", ");
          const position = offset + index + 1;

          return `${position}. [${change.id}] ${formattedDate}
   Operation: ${change.operation}
   Files: ${filesStr}
   Message: ${change.message}`;
        });

        const output = entries.join("\n\n");

        const rangeStart = offset + 1;
        const rangeEnd = offset + changes.length;
        const summary = `\nShowing changes ${rangeStart}-${rangeEnd} of ${totalCount} total.`;

        if (rangeEnd < totalCount) {
          return output + summary + `\nUse offset=${rangeEnd} to see more.`;
        }

        return output + summary;
      } catch (error: any) {
        return `Error listing history: ${error.message}`;
      }
    },
  });
};
