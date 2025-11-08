import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { validatePath } from "./pathUtils";
import { readdir } from "fs/promises";
import { stat } from "fs/promises";
import { join } from "path";

/**
 * Check if a path should be ignored based on ignore patterns
 */
function shouldIgnore(name: string, ignorePatterns: string[]): boolean {
        for (const pattern of ignorePatterns) {
                const regexPattern = pattern
                        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
                        .replace(/\*/g, ".*");
                const regex = new RegExp(`^${regexPattern}$`);
                if (regex.test(name)) {
                        return true;
                }
        }
        return false;
}

export const getListDirectoryTool = (ctl: ToolsProviderController) => {
        return tool({
                name: "list_directory",
                description:
                        "List contents of a directory with optional filtering. Path is relative to project root.",
                parameters: {
                        path: z
                                .string()
                                .optional()
                                .describe(
                                        "The directory to list, relative to project root (defaults to project root)",
                                ),
                        show_hidden: z
                                .boolean()
                                .default(false)
                                .describe("Whether to show hidden files (starting with .)"),
                        ignore_patterns: z
                                .array(z.string())
                                .optional()
                                .describe("Patterns to ignore (supports * wildcard)"),
                },
                implementation: async ({ path, show_hidden, ignore_patterns }) => {
                        const config = ctl.getPluginConfig(configSchematics);
                        const projectPath = config.get("projectPath");

                        if (!projectPath) {
                                return "Error: No project path configured.";
                        }

                        const listPath = path || "";
                        const validation = validatePath(listPath, projectPath);
                        if (!validation.valid) {
                                return validation.error;
                        }

                        try {
                                const entries = await readdir(validation.path, { withFileTypes: true });
                                const ignoreList = ignore_patterns || [];

                                const items: Array<{ name: string; type: string; size?: number }> = [];

                                for (const entry of entries) {
                                        const name = entry.name;

                                        // Skip hidden files if show_hidden is false
                                        if (!show_hidden && name.startsWith(".")) {
                                                continue;
                                        }

                                        // Skip ignored patterns
                                        if (shouldIgnore(name, ignoreList)) {
                                                continue;
                                        }

                                        const fullPath = join(validation.path, name);
                                        const stats = await stat(fullPath);

                                        items.push({
                                                name,
                                                type: entry.isDirectory() ? "dir" : "file",
                                                size: entry.isFile() ? stats.size : undefined,
                                        });
                                }

                                // Sort: directories first, then files, alphabetically
                                items.sort((a, b) => {
                                        if (a.type !== b.type) {
                                                return a.type === "dir" ? -1 : 1;
                                        }
                                        return a.name.localeCompare(b.name);
                                });

                                if (items.length === 0) {
                                        return "Directory is empty.";
                                }

                                // Format output
                                const output = items
                                        .map((item) => {
                                                const typeIndicator = item.type === "dir" ? "/" : "";
                                                const size = item.size !== undefined ? ` (${item.size} bytes)` : "";
                                                return `${item.name}${typeIndicator}${size}`;
                                        })
                                        .join("\n");

                                const pathDisplay = path || "(root)";
                                return `Contents of ${pathDisplay}:\n${output}\n\nTotal: ${items.length} item(s)`;
                        } catch (error: any) {
                                return `Error listing directory: ${error.message}`;
                        }
                },
        });
};
