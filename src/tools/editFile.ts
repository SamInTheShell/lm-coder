import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { validatePath } from "./pathUtils";
import { readFile, writeFile } from "fs/promises";

export const getEditFileTool = (ctl: ToolsProviderController) => {
        return tool({
                name: "edit_file",
                description:
                        "Replace occurrences of old_string with new_string in a file. Validates the number of replacements matches expected_replacements.",
                parameters: {
                        file_path: z.string().describe("The path to the file to edit"),
                        old_string: z.string().describe("The string to search for and replace"),
                        new_string: z.string().describe("The string to replace with"),
                        expected_replacements: z
                                .number()
                                .default(1)
                                .describe("The expected number of replacements (default: 1)"),
                },
                implementation: async ({
                        file_path,
                        old_string,
                        new_string,
                        expected_replacements,
                }) => {
                        const config = ctl.getPluginConfig(configSchematics);
                        const projectPath = config.get("projectPath");

                        const validation = validatePath(file_path, projectPath);
                        if (!validation.valid) {
                                return validation.error;
                        }

                        try {
                                const content = await readFile(validation.path, "utf-8");

                                // Count occurrences
                                const occurrences = (
                                        content.match(
                                                new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
                                        ) || []
                                ).length;

                                if (occurrences !== expected_replacements) {
                                        return `Error: Expected ${expected_replacements} replacement(s), but found ${occurrences} occurrence(s) of "${old_string}"`;
                                }

                                // Perform replacement
                                const newContent = content.replaceAll(old_string, new_string);
                                await writeFile(validation.path, newContent, "utf-8");

                                return `Successfully replaced ${occurrences} occurrence(s).`;
                        } catch (error: any) {
                                return `Error editing file: ${error.message}`;
                        }
                },
        });
};
