import type { MetaTree } from '../parser/types.js';
import type { Result } from '../schemas/common.js';
import { writeFile } from './write-file.js';

export async function writeTree(
  tree: MetaTree,
  metaDir: string,
): Promise<Result<void>> {
  try {
    const allEntities = [
      ...tree.stories,
      ...tree.epics,
      ...tree.milestones,
      ...tree.roadmaps,
      ...tree.prds,
    ];

    for (const entity of allEntities) {
      const result = await writeFile(entity, entity.filePath);
      if (!result.ok) {
        return result;
      }
    }

    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to write tree to ${metaDir}: ${err}`),
    };
  }
}
