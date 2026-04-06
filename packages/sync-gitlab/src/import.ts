import { join } from 'node:path';
import type {
  EntityRef,
  Epic,
  Milestone,
  Result,
  Roadmap,
  Story,
} from '@gitpm/core';
import { writeFile } from '@gitpm/core';
import { nanoid } from 'nanoid';
import { GitLabClient } from './client.js';
import { createDefaultConfig, saveConfig } from './config.js';
import type { LinkContext } from './linker.js';
import { resolveEpicLink } from './linker.js';
import {
  determineFilePath,
  glEpicToEpic,
  glIssueToEntity,
  glMilestoneToMilestone,
  isEpicIssue,
} from './mapper.js';
import { computeContentHash, createInitialState, saveState } from './state.js';
import type {
  GitLabConfig,
  ImportOptions,
  ImportResult,
  LinkStrategy,
} from './types.js';

export async function importFromGitLab(
  options: ImportOptions,
): Promise<Result<ImportResult>> {
  try {
    const { token, project, metaDir, statusMapping } = options;
    const baseUrl = options.baseUrl ?? 'https://gitlab.com';

    // 1. Create GitLab client
    const client = new GitLabClient(token, baseUrl);

    // 2. Resolve project ID
    let projectId = options.projectId;
    let groupId = options.groupId;
    if (!projectId) {
      const glProject = await client.getProject(project);
      projectId = glProject.id;
      if (!groupId && glProject.namespace.kind === 'group') {
        groupId = glProject.namespace.id;
      }
    }

    // 3. Fetch milestones
    const glMilestones = await client.listMilestones(projectId);

    // 4. Fetch all issues
    const glIssues = await client.listIssues(projectId, { state: 'all' });

    // 5. Build config for label detection
    const config: GitLabConfig = createDefaultConfig(
      project,
      projectId,
      baseUrl,
      groupId,
      statusMapping,
    );

    // 6. Try fetching native GitLab epics (Premium feature)
    const nativeEpics = groupId ? await client.listGroupEpics(groupId) : [];

    // 7. Convert milestones — build id→entityId map
    const milestones: Milestone[] = [];
    const milestoneIdToEntityId = new Map<number, string>();
    for (const glMs of glMilestones) {
      const ms = glMilestoneToMilestone(glMs, projectId, baseUrl);
      const hash = computeContentHash(ms);
      if (ms.gitlab) {
        ms.gitlab.last_sync_hash = hash;
      }
      milestones.push(ms);
      milestoneIdToEntityId.set(glMs.id, ms.id);
    }

    // 8. Convert issues — separate epics and stories
    const epics: Epic[] = [];
    const stories: Story[] = [];
    const issueIidToEntity = new Map<number, Epic | Story>();

    // First pass: identify epics (either native or label-based)
    // Add native epics first
    for (const glEpic of nativeEpics) {
      const epic = glEpicToEpic(glEpic, projectId, baseUrl);
      const hash = computeContentHash(epic);
      if (epic.gitlab) {
        epic.gitlab.last_sync_hash = hash;
      }
      epics.push(epic);
    }

    // Process issues
    for (const glIssue of glIssues) {
      const entity = glIssueToEntity(glIssue, config, projectId, baseUrl);
      issueIidToEntity.set(glIssue.iid, entity);

      if (entity.type === 'epic') {
        // Set milestone ref if issue has milestone
        if (glIssue.milestone) {
          const msEntityId = milestoneIdToEntityId.get(glIssue.milestone.id);
          if (msEntityId) {
            entity.milestone_ref = { id: msEntityId } as EntityRef;
          }
        }
        epics.push(entity);
      }
    }

    // Build epic issue IID → entity map for parent resolution
    const epicIssueIidToEpic = new Map<number, Epic>();
    for (const glIssue of glIssues) {
      if (isEpicIssue(glIssue, config)) {
        const entity = issueIidToEntity.get(glIssue.iid);
        if (entity?.type === 'epic') {
          epicIssueIidToEpic.set(glIssue.iid, entity);
        }
      }
    }

    // Fetch native epic→issue relationships
    const linkStrategy: LinkStrategy = options.linkStrategy ?? 'all';
    const nativeEpicIssueIids = new Map<number, number[]>();
    if (
      groupId &&
      nativeEpics.length > 0 &&
      (linkStrategy === 'native-epics' || linkStrategy === 'all')
    ) {
      for (const glEpic of nativeEpics) {
        const epicIssues = await client.listEpicIssues(groupId, glEpic.iid);
        nativeEpicIssueIids.set(
          glEpic.iid,
          epicIssues.map((i) => i.iid),
        );
      }
    }

    // Build link context for the linker
    const linkCtx: LinkContext = {
      glIssues,
      issueIidToEntity,
      epicIssueIidToEpic,
      nativeEpicIssueIids,
    };

    // Second pass: stories — resolve epic refs
    for (const glIssue of glIssues) {
      const entity = issueIidToEntity.get(glIssue.iid);
      if (!entity || entity.type !== 'story') continue;

      let parentEpicSlug: string | undefined;

      const linkResult = resolveEpicLink(
        glIssue,
        entity,
        linkCtx,
        linkStrategy,
      );
      if (linkResult) {
        entity.epic_ref = linkResult.epicRef;
        parentEpicSlug = linkResult.parentEpicSlug;
      }

      entity.filePath = determineFilePath(entity, parentEpicSlug);

      const hash = computeContentHash(entity);
      if (entity.gitlab) {
        entity.gitlab.last_sync_hash = hash;
      }

      stories.push(entity);
    }

    // Update epic hashes after all refs are set
    for (const epic of epics) {
      epic.filePath = determineFilePath(epic);
      const hash = computeContentHash(epic);
      if (epic.gitlab) {
        epic.gitlab.last_sync_hash = hash;
      }
    }

    // 9. Build roadmap referencing all milestones
    const roadmap: Roadmap = {
      type: 'roadmap',
      id: nanoid(12),
      title: 'Roadmap',
      description: `Imported from ${project}`,
      milestones: milestones.map((ms) => ({ id: ms.id })),
      updated_at: new Date().toISOString(),
      filePath: '.meta/roadmap/roadmap.yaml',
    };

    // 10. Write all entities to disk
    let totalFiles = 0;
    const resolveEntityPath = (filePath: string) => {
      const relative = filePath.replace(/^\.meta\//, '');
      return join(metaDir, relative);
    };

    // Write roadmap
    const roadmapPath = resolveEntityPath(roadmap.filePath);
    const roadmapResult = await writeFile(roadmap, roadmapPath);
    if (!roadmapResult.ok) return roadmapResult;
    totalFiles++;

    // Write milestones
    for (const ms of milestones) {
      const msPath = resolveEntityPath(ms.filePath);
      const result = await writeFile(ms, msPath);
      if (!result.ok) return result;
      totalFiles++;
    }

    // Write epics
    for (const epic of epics) {
      const epicPath = resolveEntityPath(epic.filePath);
      const result = await writeFile(epic, epicPath);
      if (!result.ok) return result;
      totalFiles++;
    }

    // Write stories
    for (const story of stories) {
      const storyPath = resolveEntityPath(story.filePath);
      const result = await writeFile(story, storyPath);
      if (!result.ok) return result;
      totalFiles++;
    }

    // 11. Save config
    const configResult = await saveConfig(metaDir, config);
    if (!configResult.ok) return configResult;
    totalFiles++;

    // 12. Save initial sync state
    const allEntities = [...milestones, ...epics, ...stories, roadmap];
    const syncState = createInitialState(project, allEntities, projectId);
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
