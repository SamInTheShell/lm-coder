import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { validatePath, toRelativePath } from "./pathUtils";
import { readdir, readFile } from "fs/promises";
import { join, relative, sep } from "path";

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
 * Check if a filename matches a glob pattern
 */
function matchesGlob(filename: string, pattern: string): boolean {
        const regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
                .replace(/\*/g, ".*");
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filename);
}

/**
 * Recursively search for text in files
 */
async function searchTextRecursive(
        dir: string,
        pattern: string,
        includeGlob: string | undefined,
        projectRoot: string,
        gitignorePatterns: string[],
        results: Array<{ file: string; line: number; content: string }>,
): Promise<void> {
        try {
                const entries = await readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                        const fullPath = join(dir, entry.name);

                        // Skip if path should be ignored by .gitignore
                        if (shouldIgnore(fullPath, projectRoot, gitignorePatterns)) {
                                continue;
                        }

                        if (entry.isDirectory()) {
                                // Skip .git directories entirely (don't even show them in search results)
                                if (entry.name === ".git") {
                                        continue;
                                }

                                await searchTextRecursive(
                                        fullPath,
                                        pattern,
                                        includeGlob,
                                        projectRoot,
                                        gitignorePatterns,
                                        results,
                                );
                        } else if (entry.isFile()) {
                                // Check if file matches include glob pattern
                                if (includeGlob && !matchesGlob(entry.name, includeGlob)) {
                                        continue;
                                }

                                try {
                                        const content = await readFile(fullPath, "utf-8");
                                        const lines = content.split("\n");

                                        for (let i = 0; i < lines.length; i++) {
                                                if (lines[i].includes(pattern)) {
                                                        results.push({
                                                                file: fullPath,
                                                                line: i + 1,
                                                                content: lines[i].trim(),
                                                        });
                                                }
                                        }
                                } catch (error) {
                                        // Skip files we can't read (binary files, permission issues, etc.)
                                }
                        }
                }
        } catch (error) {
                // Skip directories we can't read
        }
}

export const getSearchTextTool = (ctl: ToolsProviderController) => {
        return tool({
                name: "search_text",
                description:
                        "Search for text pattern in files within the project path. Path parameter is relative to project root.",
                parameters: {
                        pattern: z.string().describe("The text pattern to search for"),
                        path: z
                                .string()
                                .optional()
                                .describe(
                                        "The directory to search in, relative to project root (defaults to project root)",
                                ),
                        include: z
                                .string()
                                .optional()
                                .describe("Glob pattern to filter files (e.g., '*.ts', '*.js')"),
                },
                implementation: async ({ pattern, path, include }) => {
                        const config = ctl.getPluginConfig(configSchematics);
                        const projectPath = config.get("projectPath");

                        if (!projectPath) {
                                return "Error: No project path configured.";
                        }

                        const searchPath = path || "";
                        const validation = validatePath(searchPath, projectPath);
                        if (!validation.valid) {
                                return validation.error;
                        }

                        try {
                                // Load .gitignore patterns
                                const gitignorePath = join(projectPath, ".gitignore");
                                const gitignorePatterns = await parseGitignore(gitignorePath);

                                const results: Array<{ file: string; line: number; content: string }> =
                                        [];

                                await searchTextRecursive(
                                        validation.path,
                                        pattern,
                                        include,
                                        projectPath,
                                        gitignorePatterns,
                                        results,
                                );

                                if (results.length === 0) {
                                        return `No matches found for pattern "${pattern}"`;
                                }

                                // Format results with relative paths
                                const output = results
                                        .slice(0, 100) // Limit to first 100 results
                                        .map((r) => {
                                                const relativePath = toRelativePath(r.file, projectPath);
                                                return `${relativePath}:${r.line}: ${r.content}`;
                                        })
                                        .join("\n");

                                const totalResults = results.length;
                                const summary =
                                        totalResults > 100
                                                ? `\n\nShowing first 100 of ${totalResults} results.`
                                                : `\n\nFound ${totalResults} match(es).`;

                                return output + summary;
                        } catch (error: any) {
                                return `Error searching text: ${error.message}`;
                        }
                },
        });
};
