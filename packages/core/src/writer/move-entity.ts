import { readdir, rmdir, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { parseFile } from '../parser/parse-file.js';
import { parseTree } from '../parser/parse-tree.js';
import type { Result } from '../schemas/common.js';
import { writeFile } from './write-file.js';

export interface MoveOptions {
  toEpic?: string;
  toOrphan?: boolean;
}

export interface MoveResult {
  oldPath: string;
  newPath: string;
}

export async function moveStory(
  metaDir: string,
  filePath: string,
  options: MoveOptions,
): Promise<Result<MoveResult>> {
  try {
    const parseResult = await parseFile(filePath);
    if (!parseResult.ok) return parseResult;

    const entity = parseResult.value;
    if (entity.type !== 'story') {
      return {
        ok: false,
        error: new Error(`Only stories can be moved. Got: ${entity.type}`),
      };
    }

    const fileName = basename(filePath);
    let newPath: string;
    let epicRefId: string | null = null;

    if (options.toOrphan) {
      newPath = join(metaDir, 'stories', fileName);
      epicRefId = null;
    } else if (options.toEpic) {
      // Resolve the epic: by ID or directory slug
      const treeResult = await parseTree(metaDir);
      if (!treeResult.ok) return treeResult;

      const epic = treeResult.value.epics.find(
        (e) =>
          e.id === options.toEpic ||
          e.filePath.includes(`/epics/${options.toEpic}/`),
      );
      if (!epic) {
        return {
          ok: false,
          error: new Error(`Epic not found: ${options.toEpic}`),
        };
      }

      epicRefId = epic.id;
      // Derive the epic's stories directory from the epic file path
      const epicDir = dirname(epic.filePath);
      newPath = join(epicDir, 'stories', fileName);
    } else {
      return {
        ok: false,
        error: new Error('Specify --to-epic or --to-orphan'),
      };
    }

    // Update the entity
    const updated = {
      ...entity,
      epic_ref: epicRefId ? { id: epicRefId } : null,
      updated_at: new Date().toISOString(),
      filePath: newPath,
    };

    // Write to new location
    const writeResult = await writeFile(updated, newPath);
    if (!writeResult.ok) return writeResult;

    // Remove old file
    await unlink(filePath);

    // Clean up empty parent directories
    try {
      const parentDir = dirname(filePath);
      const entries = await readdir(parentDir);
      if (entries.length === 0) {
        await rmdir(parentDir);
      }
    } catch {
      // Ignore cleanup failures
    }

    return { ok: true, value: { oldPath: filePath, newPath } };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to move story: ${err}`),
    };
  }
}
