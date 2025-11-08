import { resolve, normalize, relative, join, isAbsolute } from "path";
import { homedir } from "os";

/**
 * Expands ~ to home directory and resolves the path
 */
export function expandPath(path: string): string {
  if (path.startsWith("~")) {
    return resolve(homedir(), path.slice(2));
  }
  return resolve(path);
}

/**
 * Resolves a relative path (from LLM) to an absolute path within the project
 * The LLM always provides paths relative to the project root
 */
export function resolveRelativePath(
  relativePath: string,
  projectPath: string,
): string {
  const projectRoot = expandPath(projectPath);

  // Remove leading slash if present (LLM might send /hello.txt or hello.txt)
  const cleanPath = relativePath.startsWith("/")
    ? relativePath.slice(1)
    : relativePath;

  return join(projectRoot, cleanPath);
}

/**
 * Converts an absolute path to a path relative to the project root
 */
export function toRelativePath(
  absolutePath: string,
  projectPath: string,
): string {
  const projectRoot = expandPath(projectPath);
  return relative(projectRoot, absolutePath);
}

/**
 * Validates that a path is within the allowed project path
 * Returns the resolved absolute path if valid, or an error message if invalid
 * The input path should be relative to the project root
 */
export function validatePath(
  targetPath: string,
  projectPath: string,
): { valid: true; path: string } | { valid: false; error: string } {
  if (!projectPath) {
    return { valid: false, error: "Error: No project path configured." };
  }

  const resolvedProjectPath = expandPath(projectPath);

  // Resolve the target path relative to the project root
  const resolvedTargetPath = resolveRelativePath(targetPath, projectPath);

  // Normalize both paths
  const normalizedProject = normalize(resolvedProjectPath);
  const normalizedTarget = normalize(resolvedTargetPath);

  // Check if target is within project path
  const relativePath = relative(normalizedProject, normalizedTarget);

  // If relativePath starts with "..", the target is outside the project path
  if (relativePath.startsWith("..") || relativePath.startsWith("/")) {
    return {
      valid: false,
      error: `Error: Access denied. Path "${targetPath}" is outside the configured project path.`,
    };
  }

  return { valid: true, path: normalizedTarget };
}
