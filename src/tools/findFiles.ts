import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { validatePath, toRelativePath } from "./pathUtils";
import { readdir } from "fs/promises";
import { join } from "path";
import { stat } from "fs/promises";

/**
 * Recursively find files matching a pattern
 */
async function findFilesRecursive(
        dir: string,
        pattern: string,
        caseSensitive: boolean,
        results: string[] = [],
): Promise<string[]> {
        try {
                const entries = await readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                        const fullPath = join(dir, entry.name);

                        if (entry.isDirectory()) {
                                await findFilesRecursive(fullPath, pattern, caseSensitive, results);
                        } else if (entry.isFile()) {
                                const name = entry.name;
                                const patternToMatch = caseSensitive ? pattern : pattern.toLowerCase();
                                const nameToMatch = caseSensitive ? name : name.toLowerCase();

                                // Simple glob-like matching (supports * wildcard)
                                const regexPattern = patternToMatch
                                        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
                                        .replace(/\*/g, ".*");
                                const regex = new RegExp(`^${regexPattern}$`);

                                if (regex.test(nameToMatch)) {
                                        results.push(fullPath);
                                }
                        }
                }

                return results;
        } catch (error) {
                // Skip directories we can't read
                return results;
        }
}

export const getFindFilesTool = (ctl: ToolsProviderController) => {
        return tool({
                name: "find_files",
                description:
                        "Find files matching a pattern within the project path. Supports * wildcard. Path parameter is relative to project root.",
                parameters: {
                        pattern: z
                                .string()
                                .describe("The file pattern to search for (supports * wildcard)"),
                        path: z
                                .string()
                                .optional()
                                .describe(
                                        "The directory to search in, relative to project root (defaults to project root)",
                                ),
                        case_sensitive: z
                                .boolean()
                                .default(false)
                                .describe("Whether the search should be case sensitive"),
                },
                implementation: async ({ pattern, path, case_sensitive }) => {
                        const config = ctl.getPluginConfig(configSchematics);
                        const projectPath = config.get("projectPath");

                        if (!projectPath) {
                                return "Error: No project path configured.";
                        }

                        // If no path specified, search from project root (empty string = root)
                        const searchPath = path || "";
                        const validation = validatePath(searchPath, projectPath);
                        if (!validation.valid) {
                                return validation.error;
                        }

                        try {
                                const results = await findFilesRecursive(
                                        validation.path,
                                        pattern,
                                        case_sensitive,
                                );

                                if (results.length === 0) {
                                        return `No files found matching pattern "${pattern}"`;
                                }

                                // Return relative paths from the project root
                                const relativePaths = results.map((p) =>
                                        toRelativePath(p, projectPath),
                                );

                                return `Found ${results.length} file(s):\n${relativePaths.join("\n")}`;
                        } catch (error: any) {
                                return `Error finding files: ${error.message}`;
                        }
                },
        });
};
