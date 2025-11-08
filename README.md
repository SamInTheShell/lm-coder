# lm-coder

A file system and web tools plugin for LM Studio that provides LLMs with safe, sandboxed access to read, write, and manage files within a configured project directory.

## Installation

Clone this repo.

Run `lms dev` in the repo for temporary development use. This will also hot reload.

Or run `lms dev --install` in the repo for permanent installation.

## Tools

- **read_file** - Read file contents with optional line range and line numbers
- **write_file** - Create or overwrite files with content
- **edit_file** - Replace text in files with validation of replacement count
- **find_files** - Recursively search for files by pattern (supports wildcards)
- **search_text** - Search for text patterns across files with optional filtering
- **list_directory** - List directory contents with filtering options
- **remove_files** - Delete files or directories (with protection against removing project root)
- **fetch** - Fetch URLs using HTTP GET requests

## Configuration

### Project Path

The `projectPath` setting defines the root directory that all file operations are restricted to. All tools operate relative to this path and cannot access files outside of it.

**Example:** `~/my-project` or `/home/user/projects/myapp`

This ensures the LLM can only interact with files within your designated project directory for security.
