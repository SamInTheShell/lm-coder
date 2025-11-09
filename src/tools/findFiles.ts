import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { validatePath, toRelativePath } from "./pathUtils";
import { readdir, readFile } from "fs/promises";
import { join, relative, sep } from "path";
import { stat, existsSync } from "fs";

/**
 * Parse .gitignore file and return patterns
 */
async function parseGitignore(gitignorePath: string): Promise<string[]> {
        try {
                const content = await readFile(gitignorePath, "utf-8");
                return content
                        .split("\n")
                        .map((line) => line.trim())
                        .filter((line) => line && !line.startsWith("#"));
        } catch {
                return [];
        }
}

/**
 * Check if a path should be ignored based on gitignore patterns
 */
function shouldIgnore(
        path: string,
        projectPath: string,
        gitignorePatterns: string[],
): boolean {
        const relativePath = relative(projectPath, path);
        const pathParts = relativePath.split(sep);

        for (const pattern of gitignorePatterns) {
                // Handle directory patterns (ending with /)
                if (pattern.endsWith("/")) {
                        const dirPattern = pattern.slice(0, -1);
                        if (pathParts.includes(dirPattern)) {
                                return true;
                        }
                }
                // Handle exact matches
                else if (pathParts.includes(pattern)) {
                        return true;
                }
                // Handle wildcard patterns
                else if (pattern.includes("*")) {
                        const regexPattern = pattern
                                .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
                                .replace(/\*/g, ".*");
                        const regex = new RegExp(`^${regexPattern}$`);
                        if (pathParts.some((part) => regex.test(part))) {
                                return true;
                        }
                }
        }

        return false;
}

/**
 * Recursively find files matching a pattern
 */
async function findFilesRecursive(
        dir: string,
        pattern: string,
        caseSensitive: boolean,
        projectPath: string,
        gitignorePatterns: string[],
        results: string[] = [],
): Promise<string[]> {
        try {
                const entries = await readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                        const fullPath = join(dir, entry.name);

                        // Skip if path should be ignored by .gitignore
                        if (shouldIgnore(fullPath, projectPath, gitignorePatterns)) {
                                continue;
                        }

                        if (entry.isDirectory()) {
                                // Special handling for .git directories: show them but don't recurse into them
                                if (entry.name === ".git") {
                                        results.push(fullPath);
                                        continue;
                                }

                                await findFilesRecursive(
                                        fullPath,
                                        pattern,
                                        caseSensitive,
                                        projectPath,
                                        gitignorePatterns,
                                        results,
                                );
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
                                // Load .gitignore patterns
                                const gitignorePath = join(projectPath, ".gitignore");
                                const gitignorePatterns = await parseGitignore(gitignorePath);

                                const results = await findFilesRecursive(
                                        validation.path,
                                        pattern,
                                        case_sensitive,
                                        projectPath,
                                        gitignorePatterns,
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
