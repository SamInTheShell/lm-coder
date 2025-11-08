import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";
import { configSchematics } from "../configSchematics";
import { validatePath, toRelativePath } from "./pathUtils";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

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
        results: Array<{ file: string; line: number; content: string }>,
): Promise<void> {
        try {
                const entries = await readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                        const fullPath = join(dir, entry.name);

                        if (entry.isDirectory()) {
                                await searchTextRecursive(
                                        fullPath,
                                        pattern,
                                        includeGlob,
                                        projectRoot,
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
                                const results: Array<{ file: string; line: number; content: string }> =
                                        [];

                                await searchTextRecursive(
                                        validation.path,
                                        pattern,
                                        include,
                                        "",
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
