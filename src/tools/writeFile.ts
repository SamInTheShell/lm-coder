import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { validatePath } from "./pathUtils";
import { writeFile, mkdir, readFile } from "fs/promises";
import { dirname } from "path";
import { saveChange, generateChangeId, WriteDetails } from "./historyUtils";
import { existsSync } from "fs";

export const getWriteFileTool = (ctl: ToolsProviderController) => {
    return tool({
        name: "write_file",
        description: "Create or overwrite a file with the given content. Requires a change message for history tracking.",
        parameters: {
            file_path: z.string().describe("The path to the file to write"),
            content: z.string().describe("The content to write to the file"),
            change_message: z.string().describe("A message describing this change for the history log"),
        },
        implementation: async ({ file_path, content, change_message }) => {
            const config = ctl.getPluginConfig(configSchematics);
            const projectPath = config.get("projectPath");

            const validation = validatePath(file_path, projectPath);
            if (!validation.valid) {
                return validation.error;
            }

            try {
                // Check if file exists and read previous content
                let previousContent: string | null = null;
                if (existsSync(validation.path)) {
                    previousContent = await readFile(validation.path, "utf-8");
                }

                // Ensure parent directory exists
                await mkdir(dirname(validation.path), { recursive: true });
                await writeFile(validation.path, content, "utf-8");

                // Log the change
                const details: WriteDetails = {
                    type: "write",
                    file: file_path,
                    previousContent,
                    newContent: content,
                };

                await saveChange(projectPath, {
                    id: generateChangeId(),
                    timestamp: new Date().toISOString(),
                    operation: "write",
                    message: change_message,
                    files: [file_path],
                    details,
                });

                return `File written successfully.`;
            } catch (error: any) {
                return `Error writing file: ${error.message}`;
            }
        },
    });
};
