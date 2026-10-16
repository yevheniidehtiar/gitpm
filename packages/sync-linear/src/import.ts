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
import type { LinearIssue } from './client.js';
import { LinearClient } from './client.js';
import { createDefaultConfig, saveConfig } from './config.js';
import { computeRemoteIssueHash } from './diff.js';
import {
  determineFilePath,
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

    // File paths are derived from titles, which Linear does not require to
    // be unique. Disambiguate with the issue identifier / cycle number so no
    // entity silently overwrites another on disk.
    const usedPaths = new Set<string>();
    const claimPath = (
      build: (slug: string) => string,
      title: string,
      suffix: string,
    ): { slug: string; path: string } => {
      const base = toSlug(title);
      const candidates = [base, `${base}-${toSlug(suffix)}`];
      for (let n = 2; ; n++) {
        const slug = candidates.shift() ?? `${base}-${toSlug(suffix)}-${n}`;
        const path = build(slug);
        if (!usedPaths.has(path)) {
          usedPaths.add(path);
          return { slug, path };
        }
      }
    };

    // 1. Fetch cycles → milestones
    const milestones: Milestone[] = [];

    const cycles = await client.listCycles(teamId);
    for (const cycle of cycles) {
      const ms = linearCycleToMilestone(cycle, teamId);
      ms.filePath = claimPath(
        (slug) => determineFilePath(ms, undefined, slug),
        ms.title,
        `cycle-${cycle.number}`,
      ).path;
      const hash = computeContentHash(ms);
      if (ms.linear) {
        ms.linear.last_sync_hash = hash;
      }
      milestones.push(ms);
    }

    // 2. Build config
    const config: LinearConfig = createDefaultConfig(teamId, statusMapping);

    // 3. Fetch all issues for the team
    const issues = await client.listIssues(teamId);

    // 4. Separate epics and stories (an issue with sub-issues is an epic)
    const epics: Epic[] = [];
    const stories: Story[] = [];
    const remoteHashes = new Map<string, string>();
    const epicByIssueId = new Map<string, { epic: Epic; slug: string }>();
    const storyIssues: Array<{ issue: LinearIssue; story: Story }> = [];

    for (const issue of issues) {
      const entity = linearIssueToEntity(issue, config, teamId);
      remoteHashes.set(entity.id, computeRemoteIssueHash(issue, config));
      if (entity.type === 'epic') {
        const { slug, path } = claimPath(
          (s) => determineFilePath(entity, undefined, s),
          entity.title,
          issue.identifier,
        );
        entity.filePath = path;
        if (entity.linear) {
          entity.linear.last_sync_hash = computeContentHash(entity);
        }
        epics.push(entity);
        epicByIssueId.set(issue.id, { epic: entity, slug });
      } else {
        storyIssues.push({ issue, story: entity });
      }
    }

    // Stories — resolve epic refs via the parent field
    for (const { issue, story } of storyIssues) {
      const parent = issue.parent?.id
        ? epicByIssueId.get(issue.parent.id)
        : undefined;
      if (parent) {
        story.epic_ref = { id: parent.epic.id } as EntityRef;
      }

      story.filePath = claimPath(
        (s) => determineFilePath(story, parent?.slug, s),
        story.title,
        issue.identifier,
      ).path;

      if (story.linear) {
        story.linear.last_sync_hash = computeContentHash(story);
      }
      stories.push(story);
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
    const syncState = createInitialState(teamId, allEntities, remoteHashes);
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
