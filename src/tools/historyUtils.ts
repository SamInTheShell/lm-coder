import { createHash } from "crypto";
import { homedir } from "os";
import { join, resolve } from "path";
import { mkdir, readdir, readFile, writeFile, stat, rm } from "fs/promises";
import { expandPath } from "./pathUtils";

export interface ChangeEntry {
  id: string; // Timestamp-based unique ID
  timestamp: string; // ISO string
  operation: "write" | "edit" | "remove";
  message: string; // User-provided change message
  files: string[]; // Relative paths of files affected
  details: WriteDetails | EditDetails | RemoveDetails;
}

export interface WriteDetails {
  type: "write";
  file: string; // Relative path
  previousContent: string | null; // null if file was newly created
  newContent: string;
}

export interface EditDetails {
  type: "edit";
  file: string; // Relative path
  oldString: string;
  newString: string;
  previousContent: string;
  newContent: string;
}

export interface RemoveDetails {
  type: "remove";
  removedItems: Array<{
    path: string; // Relative path
    isDirectory: boolean;
    content?: string; // For files only
  }>;
}

/**
 * Generate a hash from the absolute project path
 */
export function getProjectHash(projectPath: string): string {
  const absolutePath = resolve(expandPath(projectPath));
  return createHash("sha256").update(absolutePath).digest("hex");
}

/**
 * Get the history directory path for a project
 */
export function getHistoryDir(projectPath: string): string {
  const hash = getProjectHash(projectPath);
  return join(homedir(), ".lm-coder-history", hash);
}

/**
 * Ensure history directory exists
 */
export async function ensureHistoryDir(projectPath: string): Promise<string> {
  const historyDir = getHistoryDir(projectPath);
  await mkdir(historyDir, { recursive: true });
  return historyDir;
}

/**
 * Generate a unique ID for a change entry
 */
export function generateChangeId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Save a change entry to the history
 */
export async function saveChange(
  projectPath: string,
  entry: ChangeEntry
): Promise<void> {
  const historyDir = await ensureHistoryDir(projectPath);
  const filePath = join(historyDir, `${entry.id}.json`);
  await writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
}

/**
 * List all change entries, sorted by timestamp (newest first)
 */
export async function listChanges(
  projectPath: string,
  limit: number = 20,
  offset: number = 0
): Promise<ChangeEntry[]> {
  try {
    const historyDir = getHistoryDir(projectPath);

    // Check if directory exists
    try {
      await stat(historyDir);
    } catch {
      // Directory doesn't exist yet
      return [];
    }

    const files = await readdir(historyDir);
    const jsonFiles = files.filter(f => f.endsWith(".json"));

    // Read all entries
    const entries: ChangeEntry[] = [];
    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(historyDir, file), "utf-8");
        entries.push(JSON.parse(content));
      } catch {
        // Skip corrupted files
      }
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    return entries.slice(offset, offset + limit);
  } catch (error) {
    return [];
  }
}

/**
 * Get a specific change entry by ID
 */
export async function getChange(
  projectPath: string,
  changeId: string
): Promise<ChangeEntry | null> {
  try {
    const historyDir = getHistoryDir(projectPath);
    const filePath = join(historyDir, `${changeId}.json`);
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get total count of changes
 */
export async function getChangeCount(projectPath: string): Promise<number> {
  try {
    const historyDir = getHistoryDir(projectPath);

    try {
      await stat(historyDir);
    } catch {
      return 0;
    }

    const files = await readdir(historyDir);
    return files.filter(f => f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}
