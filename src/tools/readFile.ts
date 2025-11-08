import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { validatePath } from "./pathUtils";
import { readFile } from "fs/promises";

export const getReadFileTool = (ctl: ToolsProviderController) => {
        return tool({
                name: "read_file",
                description:
                        "Read a file's contents with optional offset and limit for line-based reading.",
                parameters: {
                        file_path: z.string().describe("The path to the file to read"),
                        offset: z
                                .number()
                                .optional()
                                .describe("The line number to start reading from (0-indexed)"),
                        limit: z.number().optional().describe("The number of lines to read"),
                        show_line_numbers: z
                                .boolean()
                                .optional()
                                .describe(
                                        "Whether to display line numbers (1-indexed) before each line",
                                ),
                },
                implementation: async ({ file_path, offset, limit, show_line_numbers }) => {
                        const config = ctl.getPluginConfig(configSchematics);
                        const projectPath = config.get("projectPath");

                        const validation = validatePath(file_path, projectPath);
                        if (!validation.valid) {
                                return validation.error;
                        }

                        try {
                                const content = await readFile(validation.path, "utf-8");
                                const lines = content.split("\n");

                                // Determine which lines to show
                                const startLine = offset ?? 0;
                                const endLine = limit !== undefined ? startLine + limit : lines.length;
                                const selectedLines = lines.slice(startLine, endLine);

                                // Add line numbers if requested
                                if (show_line_numbers) {
                                        const lineNumberWidth = String(
                                                startLine + selectedLines.length,
                                        ).length;
                                        const numberedLines = selectedLines.map((line, index) => {
                                                const lineNum = startLine + index + 1; // 1-indexed for display
                                                const paddedNum = String(lineNum).padStart(lineNumberWidth, " ");
                                                return `${paddedNum} | ${line}`;
                                        });
                                        return numberedLines.join("\n");
                                }

                                return selectedLines.join("\n");
                        } catch (error: any) {
                                return `Error reading file: ${error.message}`;
                        }
                },
        });
};
