import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { validatePath } from "./pathUtils";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";

export const getWriteFileTool = (ctl: ToolsProviderController) => {
    return tool({
        name: "write_file",
        description: "Create or overwrite a file with the given content.",
        parameters: {
            file_path: z.string().describe("The path to the file to write"),
            content: z.string().describe("The content to write to the file"),
        },
        implementation: async ({ file_path, content }) => {
            const config = ctl.getPluginConfig(configSchematics);
            const projectPath = config.get("projectPath");

            const validation = validatePath(file_path, projectPath);
            if (!validation.valid) {
                return validation.error;
            }

            try {
                // Ensure parent directory exists
                await mkdir(dirname(validation.path), { recursive: true });
                await writeFile(validation.path, content, "utf-8");
                return `File written successfully.`;
            } catch (error: any) {
                return `Error writing file: ${error.message}`;
            }
        },
    });
};
