import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Result } from '../schemas/common.js';
import { parseFile } from './parse-file.js';
import type { MetaTree } from './types.js';

async function globFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip sync, config, and archive directories
        if (entry.name === 'sync' || entry.name === '.gitpm' || entry.name === 'archive') continue;
        await walk(fullPath);
      } else if (
        entry.name.endsWith('.md') ||
        entry.name.endsWith('.yaml') ||
        entry.name.endsWith('.yml')
      ) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

export async function parseTree(metaDir: string): Promise<Result<MetaTree>> {
  try {
    const files = await globFiles(metaDir);
    const tree: MetaTree = {
      stories: [],
      epics: [],
      milestones: [],
      roadmaps: [],
      prds: [],
      errors: [],
    };

    for (const filePath of files) {
      const result = await parseFile(filePath);
      if (!result.ok) {
        tree.errors.push({
          filePath,
          message: result.error.message,
        });
        continue;
      }

      const entity = result.value;
      switch (entity.type) {
        case 'story':
          tree.stories.push(entity);
          break;
        case 'epic':
          tree.epics.push(entity);
          break;
        case 'milestone':
          tree.milestones.push(entity);
          break;
        case 'roadmap':
          tree.roadmaps.push(entity);
          break;
        case 'prd':
          tree.prds.push(entity);
          break;
      }
    }

    return { ok: true, value: tree };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to parse tree at ${metaDir}: ${err}`),
    };
  }
}
