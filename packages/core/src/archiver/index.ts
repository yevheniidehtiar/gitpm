import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { parseFile } from '../parser/parse-file.js';
import type { Result } from '../schemas/common.js';

export interface ArchiveOptions {
  /** Number of days after which done items are archived (default: 7) */
  daysOld: number;
  /** Dry run — list files without moving them */
  dryRun: boolean;
}

export interface ArchiveResult {
  archivedFiles: string[];
  archivedEntityIds: string[];
  skippedFiles: string[];
}

const TERMINAL_STATUSES = new Set(['done', 'cancelled']);

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'sync' || entry.name === 'archive') continue;
        await walk(fullPath);
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

function isOlderThan(dateStr: string, daysOld: number, now: Date): boolean {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = new Date(now.getTime() - daysOld * 24 * 60 * 60 * 1000);
  return date < cutoff;
}

export async function archiveOldEntities(
  metaDir: string,
  options: ArchiveOptions,
): Promise<Result<ArchiveResult>> {
  try {
    const now = new Date();
    const files = await collectMarkdownFiles(metaDir);
    const archiveDir = join(metaDir, 'archive');
    const archivedFiles: string[] = [];
    const archivedEntityIds: string[] = [];
    const skippedFiles: string[] = [];

    for (const filePath of files) {
      const result = await parseFile(filePath);
      if (!result.ok) {
        skippedFiles.push(filePath);
        continue;
      }

      const entity = result.value;

      // Roadmaps don't have a status — skip them
      if (entity.type === 'roadmap') {
        skippedFiles.push(filePath);
        continue;
      }

      // Only archive entities with terminal statuses
      if (!TERMINAL_STATUSES.has(entity.status)) {
        skippedFiles.push(filePath);
        continue;
      }

      // Use updated_at as the best proxy for when the item was completed
      const dateField = entity.updated_at ?? entity.created_at;
      if (!dateField || !isOlderThan(dateField, options.daysOld, now)) {
        skippedFiles.push(filePath);
        continue;
      }

      // Compute archive destination preserving relative structure
      const rel = relative(metaDir, filePath);
      const dest = join(archiveDir, rel);

      if (!options.dryRun) {
        await mkdir(dirname(dest), { recursive: true });
        await copyFile(filePath, dest);
        await rm(filePath);

        // If parent epic directory is now empty of .md files, check if epic.md
        // itself was archived and clean up the empty dir
        const parentDir = dirname(filePath);
        if (parentDir !== metaDir) {
          const remaining = await readdir(parentDir);
          const hasMarkdown = remaining.some(
            (f) =>
              f.endsWith('.md') || f.endsWith('.yaml') || f.endsWith('.yml'),
          );
          const hasSubdirs = await Promise.all(
            remaining.map(async (f) => {
              const s = await stat(join(parentDir, f));
              return s.isDirectory();
            }),
          );
          if (
            !hasMarkdown &&
            !hasSubdirs.some(Boolean) &&
            remaining.length === 0
          ) {
            await rm(parentDir, { recursive: true });
          }
        }
      }

      archivedFiles.push(rel);
      archivedEntityIds.push(entity.id);
    }

    return {
      ok: true,
      value: { archivedFiles, archivedEntityIds, skippedFiles },
    };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Archive failed: ${err}`),
    };
  }
}
