import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { getChange, WriteDetails, EditDetails, RemoveDetails } from "./historyUtils";

export const getGetChangeDetailsTool = (ctl: ToolsProviderController) => {
  return tool({
    name: "get_change_details",
    description: "Get detailed information about a specific change from the history, including full file contents and changes.",
    parameters: {
      change_id: z.string().describe("The ID of the change to retrieve details for"),
    },
    implementation: async ({ change_id }) => {
      const config = ctl.getPluginConfig(configSchematics);
      const projectPath = config.get("projectPath");

      if (!projectPath) {
        return "Error: No project path configured.";
      }

      try {
        const change = await getChange(projectPath, change_id);

        if (!change) {
          return `Error: Change with ID "${change_id}" not found.`;
        }

        const date = new Date(change.timestamp);
        const formattedDate = date.toLocaleString();

        let output = `Change ID: ${change.id}
Timestamp: ${formattedDate}
Operation: ${change.operation}
Message: ${change.message}
Files: ${change.files.join(", ")}

--- Details ---
`;

        // Format details based on operation type
        if (change.details.type === "write") {
          const details = change.details as WriteDetails;
          output += `\nFile: ${details.file}\n`;

          if (details.previousContent === null) {
            output += `\nThis was a new file creation.\n`;
          } else {
            output += `\nPrevious content:\n${details.previousContent}\n`;
          }

          output += `\nNew content:\n${details.newContent}`;
        } else if (change.details.type === "edit") {
          const details = change.details as EditDetails;
          output += `\nFile: ${details.file}\n`;
          output += `Replaced: "${details.oldString}"\n`;
          output += `With: "${details.newString}"\n`;
          output += `\nPrevious content:\n${details.previousContent}\n`;
          output += `\nNew content:\n${details.newContent}`;
        } else if (change.details.type === "remove") {
          const details = change.details as RemoveDetails;
          output += `\nRemoved ${details.removedItems.length} item(s):\n`;

          for (const item of details.removedItems) {
            if (item.isDirectory) {
              output += `\n[DIR] ${item.path}`;
            } else {
              output += `\n[FILE] ${item.path}`;
              if (item.content !== undefined) {
                output += `\nContent:\n${item.content}\n`;
              } else {
                output += ` (binary or unreadable)\n`;
              }
            }
          }
        }

        return output;
      } catch (error: any) {
        return `Error retrieving change details: ${error.message}`;
      }
    },
  });
};
