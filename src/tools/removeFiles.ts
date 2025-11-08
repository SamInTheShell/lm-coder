import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { validatePath, expandPath, toRelativePath } from "./pathUtils";
import { unlink, rm, readdir, readFile } from "fs/promises";
import { stat } from "fs/promises";
import { normalize, join } from "path";
import { saveChange, generateChangeId, RemoveDetails } from "./historyUtils";

/**
 * Recursively capture all files in a directory before deletion
 */
async function captureDirectoryContents(
        dirPath: string,
        projectPath: string,
        items: Array<{ path: string; isDirectory: boolean; content?: string }>
): Promise<void> {
        const entries = await readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
                const fullPath = join(dirPath, entry.name);
                const relativePath = toRelativePath(fullPath, projectPath);

                if (entry.isDirectory()) {
                        items.push({ path: relativePath, isDirectory: true });
                        await captureDirectoryContents(fullPath, projectPath, items);
                } else {
                        try {
                                const content = await readFile(fullPath, "utf-8");
                                items.push({ path: relativePath, isDirectory: false, content });
                        } catch {
                                // If we can't read it (binary file), store without content
                                items.push({ path: relativePath, isDirectory: false });
                        }
                }
        }
}

export const getRemoveFilesTool = (ctl: ToolsProviderController) => {
        return tool({
                name: "remove_files",
                description:
                        "Remove one or more files or directories. Paths are relative to project root. Requires a change message for history tracking.",
                parameters: {
                        paths: z
                                .array(z.string())
                                .describe(
                                        "Array of file or directory paths to remove, relative to project root",
                                ),
                        change_message: z.string().describe("A message describing this change for the history log"),
                },
                implementation: async ({ paths, change_message }) => {
                        const config = ctl.getPluginConfig(configSchematics);
                        const projectPath = config.get("projectPath");

                        const results: string[] = [];
                        const errors: string[] = [];
                        const removedItems: Array<{ path: string; isDirectory: boolean; content?: string }> = [];

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
                                                // Capture directory contents before removal
                                                removedItems.push({ path, isDirectory: true });
                                                await captureDirectoryContents(validation.path, projectPath, removedItems);

                                                // Remove directory and all contents
                                                await rm(validation.path, { recursive: true, force: true });
                                                results.push(`Removed directory: ${path}`);
                                        } else {
                                                // Capture file content before removal
                                                try {
                                                        const content = await readFile(validation.path, "utf-8");
                                                        removedItems.push({ path, isDirectory: false, content });
                                                } catch {
                                                        // Binary file or unreadable
                                                        removedItems.push({ path, isDirectory: false });
                                                }

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

                        // Log the change if any files were removed
                        if (removedItems.length > 0) {
                                const details: RemoveDetails = {
                                        type: "remove",
                                        removedItems,
                                };

                                await saveChange(projectPath, {
                                        id: generateChangeId(),
                                        timestamp: new Date().toISOString(),
                                        operation: "remove",
                                        message: change_message,
                                        files: paths,
                                        details,
                                });
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
