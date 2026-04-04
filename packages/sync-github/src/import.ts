import { join } from 'node:path';
import { toSlug, writeFile } from '@gitpm/core';
import type {
  EntityRef,
  Epic,
  Milestone,
  Result,
  Roadmap,
  Story,
} from '@gitpm/core';
import { nanoid } from 'nanoid';
import { GitHubClient } from './client.js';
import { createDefaultConfig, saveConfig } from './config.js';
import {
  determineFilePath,
  ghIssueToEntity,
  ghMilestoneToMilestone,
  isEpicIssue,
} from './mapper.js';
import { computeContentHash, createInitialState, saveState } from './state.js';
import type { GitHubConfig, ImportOptions, ImportResult } from './types.js';

export async function importFromGitHub(
  options: ImportOptions,
): Promise<Result<ImportResult>> {
  try {
    const { token, repo, projectNumber, metaDir, statusMapping } = options;
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      return {
        ok: false,
        error: new Error(
          `Invalid repo format: "${repo}". Expected "owner/repo".`,
        ),
      };
    }

    // 1. Create GitHub client
    const client = new GitHubClient(token);

    // 2. Fetch milestones
    const ghMilestones = await client.listMilestones(owner, repoName);

    // 3. Fetch all issues
    const ghIssues = await client.listIssues(owner, repoName, { state: 'all' });

    // 4. Build config for label detection
    const config: GitHubConfig = createDefaultConfig(
      repo,
      projectNumber,
      statusMapping as Record<string, string> | undefined,
    );

    // 5. Convert milestones — build number→id map
    const milestones: Milestone[] = [];
    const milestoneNumberToId = new Map<number, string>();
    for (const ghMs of ghMilestones) {
      const ms = ghMilestoneToMilestone(ghMs, repo);
      // Recompute hash after full construction
      const hash = computeContentHash(ms);
      if (ms.github) {
        ms.github.last_sync_hash = hash;
      }
      milestones.push(ms);
      milestoneNumberToId.set(ghMs.number, ms.id);
    }

    // 6. Convert issues — separate epics and stories
    const epics: Epic[] = [];
    const stories: Story[] = [];
    const issueNumberToEntity = new Map<number, Epic | Story>();

    // First pass: identify epics
    for (const ghIssue of ghIssues) {
      const entity = ghIssueToEntity(ghIssue, config, repo);
      issueNumberToEntity.set(ghIssue.number, entity);

      if (entity.type === 'epic') {
        // Set milestone ref if issue has milestone
        if (ghIssue.milestone) {
          const msId = milestoneNumberToId.get(ghIssue.milestone.number);
          if (msId) {
            entity.milestone_ref = { id: msId } as EntityRef;
          }
        }
        epics.push(entity);
      }
    }

    // Build epic issue number → entity map for parent resolution
    const epicIssueNumberToEpic = new Map<number, Epic>();
    for (const ghIssue of ghIssues) {
      if (isEpicIssue(ghIssue, config)) {
        const entity = issueNumberToEntity.get(ghIssue.number);
        if (entity?.type === 'epic') {
          epicIssueNumberToEpic.set(ghIssue.number, entity);
        }
      }
    }

    // Second pass: stories — resolve epic refs via body references
    for (const ghIssue of ghIssues) {
      const entity = issueNumberToEntity.get(ghIssue.number);
      if (!entity || entity.type !== 'story') continue;

      // Try to find parent epic from milestone match or body refs
      let parentEpicSlug: string | undefined;

      // Check if story belongs to an epic by looking for "#<number>" refs in body
      if (ghIssue.body) {
        for (const [epicNumber, epic] of epicIssueNumberToEpic) {
          const refPattern = new RegExp(`#${epicNumber}\\b`);
          if (refPattern.test(ghIssue.body)) {
            entity.epic_ref = { id: epic.id };
            parentEpicSlug = toSlug(epic.title);
            break;
          }
        }
      }

      // Set file path
      entity.filePath = determineFilePath(entity, parentEpicSlug);

      // Compute and set hash
      const hash = computeContentHash(entity);
      if (entity.github) {
        entity.github.last_sync_hash = hash;
      }

      stories.push(entity);
    }

    // Update epic hashes after all refs are set
    for (const epic of epics) {
      epic.filePath = determineFilePath(epic);
      const hash = computeContentHash(epic);
      if (epic.github) {
        epic.github.last_sync_hash = hash;
      }
    }

    // 7. Build roadmap referencing all milestones
    const roadmap: Roadmap = {
      type: 'roadmap',
      id: nanoid(12),
      title: 'Roadmap',
      description: `Imported from ${repo}`,
      milestones: milestones.map((ms) => ({ id: ms.id })),
      updated_at: new Date().toISOString(),
      filePath: '.meta/roadmap/roadmap.yaml',
    };

    // 8. Write all entities to disk
    let totalFiles = 0;

    // Write roadmap
    const roadmapPath = join(metaDir, 'roadmap', 'roadmap.yaml');
    const roadmapResult = await writeFile(roadmap, roadmapPath);
    if (!roadmapResult.ok) return roadmapResult;
    totalFiles++;

    // Write milestones
    for (const ms of milestones) {
      const msPath = join(metaDir, '..', ms.filePath);
      const result = await writeFile(ms, msPath);
      if (!result.ok) return result;
      totalFiles++;
    }

    // Write epics
    for (const epic of epics) {
      const epicPath = join(metaDir, '..', epic.filePath);
      const result = await writeFile(epic, epicPath);
      if (!result.ok) return result;
      totalFiles++;
    }

    // Write stories
    for (const story of stories) {
      const storyPath = join(metaDir, '..', story.filePath);
      const result = await writeFile(story, storyPath);
      if (!result.ok) return result;
      totalFiles++;
    }

    // 9. Save config
    const configResult = await saveConfig(metaDir, config);
    if (!configResult.ok) return configResult;
    totalFiles++;

    // 10. Save initial sync state
    const allEntities = [...milestones, ...epics, ...stories, roadmap];
    const syncState = createInitialState(repo, allEntities, projectNumber);
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
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(`Import failed: ${err}`),
    };
  }
}
