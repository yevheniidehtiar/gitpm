import { join } from 'node:path';
import type {
  EntityRef,
  Epic,
  Milestone,
  Result,
  Roadmap,
  Story,
} from '@gitpm/core';
import { toSlug, writeFile } from '@gitpm/core';
import { nanoid } from 'nanoid';
import { LinearClient } from './client.js';
import { createDefaultConfig, saveConfig } from './config.js';
import {
  determineFilePath,
  isEpicIssue,
  linearCycleToMilestone,
  linearIssueToEntity,
} from './mapper.js';
import { computeContentHash, createInitialState, saveState } from './state.js';
import type {
  ImportResult,
  LinearConfig,
  LinearImportOptions,
} from './types.js';

export async function importFromLinear(
  options: LinearImportOptions,
): Promise<Result<ImportResult>> {
  try {
    const { apiKey, teamId, metaDir, statusMapping } = options;

    const client = new LinearClient({ apiKey });

    // 1. Fetch cycles → milestones
    const milestones: Milestone[] = [];
    const cycleIdToMilestoneId = new Map<string, string>();

    const cycles = await client.listCycles(teamId);
    for (const cycle of cycles) {
      const ms = linearCycleToMilestone(cycle, teamId);
      const hash = computeContentHash(ms);
      if (ms.linear) {
        ms.linear.last_sync_hash = hash;
      }
      milestones.push(ms);
      cycleIdToMilestoneId.set(cycle.id, ms.id);
    }

    // 2. Build config
    const config: LinearConfig = createDefaultConfig(teamId, statusMapping);

    // 3. Fetch all issues for the team
    const issues = await client.listIssues(teamId);

    // 4. Separate epics and stories
    const epics: Epic[] = [];
    const stories: Story[] = [];
    const issueIdToEntity = new Map<string, Epic | Story>();

    // First pass: identify epics (issues with sub-issues)
    for (const issue of issues) {
      const entity = linearIssueToEntity(issue, config, teamId);
      issueIdToEntity.set(issue.id, entity);

      if (entity.type === 'epic') {
        epics.push(entity);
      }
    }

    // Build epic id → entity map
    const epicIdToEpic = new Map<string, Epic>();
    for (const issue of issues) {
      if (isEpicIssue(issue)) {
        const entity = issueIdToEntity.get(issue.id);
        if (entity?.type === 'epic') {
          epicIdToEpic.set(issue.id, entity);
        }
      }
    }

    // Second pass: stories — resolve epic refs via the parent field
    for (const issue of issues) {
      const entity = issueIdToEntity.get(issue.id);
      if (!entity || entity.type !== 'story') continue;

      let parentEpicSlug: string | undefined;

      const parentId = issue.parent?.id;
      if (parentId) {
        const parentEpic = epicIdToEpic.get(parentId);
        if (parentEpic) {
          entity.epic_ref = { id: parentEpic.id } as EntityRef;
          parentEpicSlug = toSlug(parentEpic.title);
        }
      }

      // Link cycle → milestone
      if (issue.cycle && cycleIdToMilestoneId.has(issue.cycle.id)) {
        if (entity.linear) {
          entity.linear.cycle_id = issue.cycle.id;
        }
      }

      entity.filePath = determineFilePath(entity, parentEpicSlug);

      const hash = computeContentHash(entity);
      if (entity.linear) {
        entity.linear.last_sync_hash = hash;
      }

      stories.push(entity);
    }

    // Update epic file paths and hashes
    for (const epic of epics) {
      epic.filePath = determineFilePath(epic);
      const hash = computeContentHash(epic);
      if (epic.linear) {
        epic.linear.last_sync_hash = hash;
      }
    }

    // 5. Build roadmap
    const roadmap: Roadmap = {
      type: 'roadmap',
      id: nanoid(12),
      title: 'Roadmap',
      description: `Imported from Linear team ${teamId}`,
      milestones: milestones.map((ms) => ({ id: ms.id })),
      updated_at: new Date().toISOString(),
      filePath: '.meta/roadmap/roadmap.yaml',
    };

    // 6. Write all entities to disk
    let totalFiles = 0;
    const writtenPaths: string[] = [];
    const resolveEntityPath = (filePath: string) => {
      const relative = filePath.replace(/^\.meta\//, '');
      return join(metaDir, relative);
    };

    const roadmapPath = resolveEntityPath(roadmap.filePath);
    const roadmapResult = await writeFile(roadmap, roadmapPath);
    if (!roadmapResult.ok) return roadmapResult;
    totalFiles++;
    writtenPaths.push(roadmap.filePath);

    for (const ms of milestones) {
      const msPath = resolveEntityPath(ms.filePath);
      const result = await writeFile(ms, msPath);
      if (!result.ok) return result;
      totalFiles++;
      writtenPaths.push(ms.filePath);
    }

    for (const epic of epics) {
      const epicPath = resolveEntityPath(epic.filePath);
      const result = await writeFile(epic, epicPath);
      if (!result.ok) return result;
      totalFiles++;
      writtenPaths.push(epic.filePath);
    }

    for (const story of stories) {
      const storyPath = resolveEntityPath(story.filePath);
      const result = await writeFile(story, storyPath);
      if (!result.ok) return result;
      totalFiles++;
      writtenPaths.push(story.filePath);
    }

    // 7. Save config
    const configResult = await saveConfig(metaDir, config);
    if (!configResult.ok) return configResult;
    totalFiles++;

    // 8. Save initial sync state
    const allEntities = [...milestones, ...epics, ...stories, roadmap];
    const syncState = createInitialState(teamId, allEntities);
    const stateResult = await saveState(metaDir, syncState);
    if (!stateResult.ok) return stateResult;
    totalFiles++;

    return {
      ok: true,
      value: {
        milestones: milestones.length,
        epics: epics.length,
        stories: stories.length,
        totalFiles,
        writtenPaths,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err : new Error(`Linear import failed: ${err}`),
    };
  }
}
