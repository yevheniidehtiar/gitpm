import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import type { MetaTree } from '../parser/types.js';
import type { Result } from '../schemas/common.js';
import { toSlug } from './slug.js';
import { writeTree } from './write-tree.js';

export async function scaffoldMeta(
  metaDir: string,
  projectName: string,
): Promise<Result<void>> {
  try {
    const rmId = nanoid(12);
    const msId = nanoid(12);
    const epId = nanoid(12);
    const stId = nanoid(12);

    const _slug = toSlug(projectName);

    await mkdir(metaDir, { recursive: true });

    const tree: MetaTree = {
      roadmaps: [
        {
          type: 'roadmap',
          id: rmId,
          title: `${projectName} Roadmap`,
          description: `Product roadmap for ${projectName}`,
          milestones: [{ id: msId }],
          updated_at: new Date().toISOString(),
          filePath: join(metaDir, 'roadmap', 'roadmap.yaml'),
        },
      ],
      milestones: [
        {
          type: 'milestone',
          id: msId,
          title: 'MVP Launch',
          target_date: '',
          status: 'in_progress',
          body: '## Key Objectives\n\n- Launch the MVP',
          filePath: join(metaDir, 'roadmap', 'milestones', 'mvp-launch.md'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      epics: [
        {
          type: 'epic',
          id: epId,
          title: 'Initial Setup',
          status: 'in_progress',
          priority: 'high',
          labels: [],
          milestone_ref: { id: msId },
          body: '## Overview\n\nInitial project setup and configuration.',
          filePath: join(metaDir, 'epics', 'initial-setup', 'epic.md'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      stories: [
        {
          type: 'story',
          id: stId,
          title: 'Project scaffolding',
          status: 'todo',
          priority: 'high',
          labels: [],
          epic_ref: { id: epId },
          body: '## Description\n\nSet up the project structure and tooling.',
          filePath: join(
            metaDir,
            'epics',
            'initial-setup',
            'stories',
            'project-scaffolding.md',
          ),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      prds: [],
      sprints: [],
      errors: [],
    };

    return writeTree(tree, metaDir);
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to scaffold .meta/ in ${metaDir}: ${err}`),
    };
  }
}
