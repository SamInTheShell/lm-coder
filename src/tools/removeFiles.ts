import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { validatePath, expandPath } from "./pathUtils";
import { unlink, rm } from "fs/promises";
import { stat } from "fs/promises";
import { normalize } from "path";

export const getRemoveFilesTool = (ctl: ToolsProviderController) => {
        return tool({
                name: "remove_files",
                description:
                        "Remove one or more files or directories. Paths are relative to project root.",
                parameters: {
                        paths: z
                                .array(z.string())
                                .describe(
                                        "Array of file or directory paths to remove, relative to project root",
                                ),
                },
                implementation: async ({ paths }) => {
                        const config = ctl.getPluginConfig(configSchematics);
                        const projectPath = config.get("projectPath");

                        const results: string[] = [];
                        const errors: string[] = [];

                        for (const path of paths) {
                                const validation = validatePath(path, projectPath);
                                if (!validation.valid) {
                                        errors.push(validation.error);
                                        continue;
                                }

                                // Check if trying to remove the project root itself
                                const projectRoot = normalize(expandPath(projectPath));
                                const targetPath = normalize(validation.path);

                                if (targetPath === projectRoot) {
                                        errors.push("Error: Cannot remove the project root directory.");
                                        continue;
                                }

                                try {
                                        const stats = await stat(validation.path);

                                        if (stats.isDirectory()) {
                                                // Remove directory and all contents
                                                await rm(validation.path, { recursive: true, force: true });
                                                results.push(`Removed directory: ${path}`);
                                        } else {
                                                // Remove file
                                                await unlink(validation.path);
                                                results.push(`Removed file: ${path}`);
                                        }
                                } catch (error: any) {
                                        if (error.code === "ENOENT") {
                                                errors.push(`File or directory not found: ${path}`);
                                        } else {
                                                errors.push(`Error removing ${path}: ${error.message}`);
                                        }
                                }
                        }

                        const output: string[] = [];

                        if (results.length > 0) {
                                output.push(results.join("\n"));
                        }

                        if (errors.length > 0) {
                                if (results.length > 0) {
                                        output.push("");
                                }
                                output.push("Errors:");
                                output.push(errors.join("\n"));
                        }

                        return output.length > 0 ? output.join("\n") : "No files were removed.";
                },
        });
};
