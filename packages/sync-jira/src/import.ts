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
import { JiraClient } from './client.js';
import type { JiraIssue } from './client.js';
import { createDefaultConfig, saveConfig } from './config.js';
import {
  determineFilePath,
  isEpicIssue,
  jiraIssueToEntity,
  jiraSprintToMilestone,
} from './mapper.js';
import { computeContentHash, createInitialState, saveState } from './state.js';
import type { ImportResult, JiraConfig, JiraImportOptions } from './types.js';

export async function importFromJira(
  options: JiraImportOptions,
): Promise<Result<ImportResult>> {
  try {
    const { email, apiToken, site, projectKey, metaDir, statusMapping } =
      options;

    const client = new JiraClient({ site, email, apiToken });

    // 1. Discover board for sprints
    let boardId = options.boardId;
    if (!boardId) {
      const board = await client.getBoard(projectKey);
      boardId = board?.id;
    }

    // 2. Fetch sprints → milestones
    const milestones: Milestone[] = [];
    const sprintIdToMilestoneId = new Map<number, string>();

    if (boardId) {
      const sprints = await client.listSprints(boardId);
      for (const sprint of sprints) {
        const ms = jiraSprintToMilestone(sprint, site, projectKey);
        const hash = computeContentHash(ms);
        if (ms.jira) {
          ms.jira.last_sync_hash = hash;
        }
        milestones.push(ms);
        sprintIdToMilestoneId.set(sprint.id, ms.id);
      }
    }

    // 3. Build config
    const config: JiraConfig = createDefaultConfig(
      site,
      projectKey,
      boardId,
      statusMapping,
    );

    // 4. Fetch all issues via JQL
    const jql = `project = "${projectKey}" ORDER BY created ASC`;
    const jiraIssues = await client.searchIssues(jql);

    // 5. Separate epics and stories
    const epics: Epic[] = [];
    const stories: Story[] = [];
    const issueKeyToEntity = new Map<string, Epic | Story>();

    // First pass: identify epics
    for (const jiraIssue of jiraIssues) {
      const entity = jiraIssueToEntity(jiraIssue, config, site);
      issueKeyToEntity.set(jiraIssue.key, entity);

      if (entity.type === 'epic') {
        // Link sprint → milestone
        if (jiraIssue.fields.sprint) {
          const msId = sprintIdToMilestoneId.get(jiraIssue.fields.sprint.id);
          if (msId) {
            entity.milestone_ref = { id: msId } as EntityRef;
          }
        }
        epics.push(entity);
      }
    }

    // Build epic key → entity map
    const epicKeyToEpic = new Map<string, Epic>();
    for (const jiraIssue of jiraIssues) {
      if (isEpicIssue(jiraIssue, config)) {
        const entity = issueKeyToEntity.get(jiraIssue.key);
        if (entity?.type === 'epic') {
          epicKeyToEpic.set(jiraIssue.key, entity);
        }
      }
    }

    // Second pass: stories — resolve epic refs via parent field
    for (const jiraIssue of jiraIssues) {
      const entity = issueKeyToEntity.get(jiraIssue.key);
      if (!entity || entity.type !== 'story') continue;

      let parentEpicSlug: string | undefined;

      // Resolve epic link via Jira parent field
      const parentKey = jiraIssue.fields.parent?.key;
      if (parentKey) {
        const parentEpic = epicKeyToEpic.get(parentKey);
        if (parentEpic) {
          entity.epic_ref = { id: parentEpic.id } as EntityRef;
          parentEpicSlug = toSlug(parentEpic.title);
        }
      }

      // Link sprint → milestone for stories too
      if (jiraIssue.fields.sprint) {
        // Stories don't have milestone_ref directly, but we track the sprint
        // in the jira sync metadata
        if (entity.jira) {
          entity.jira.sprint_id = jiraIssue.fields.sprint.id;
        }
      }

      entity.filePath = determineFilePath(entity, parentEpicSlug);

      const hash = computeContentHash(entity);
      if (entity.jira) {
        entity.jira.last_sync_hash = hash;
      }

      stories.push(entity);
    }

    // Update epic file paths and hashes
    for (const epic of epics) {
      epic.filePath = determineFilePath(epic);
      const hash = computeContentHash(epic);
      if (epic.jira) {
        epic.jira.last_sync_hash = hash;
      }
    }

    // 6. Build roadmap
    const roadmap: Roadmap = {
      type: 'roadmap',
      id: nanoid(12),
      title: 'Roadmap',
      description: `Imported from Jira project ${projectKey}`,
      milestones: milestones.map((ms) => ({ id: ms.id })),
      updated_at: new Date().toISOString(),
      filePath: '.meta/roadmap/roadmap.yaml',
    };

    // 7. Write all entities to disk
    let totalFiles = 0;
    const resolveEntityPath = (filePath: string) => {
      const relative = filePath.replace(/^\.meta\//, '');
      return join(metaDir, relative);
    };

    const roadmapPath = resolveEntityPath(roadmap.filePath);
    const roadmapResult = await writeFile(roadmap, roadmapPath);
    if (!roadmapResult.ok) return roadmapResult;
    totalFiles++;

    for (const ms of milestones) {
      const msPath = resolveEntityPath(ms.filePath);
      const result = await writeFile(ms, msPath);
      if (!result.ok) return result;
      totalFiles++;
    }

    for (const epic of epics) {
      const epicPath = resolveEntityPath(epic.filePath);
      const result = await writeFile(epic, epicPath);
      if (!result.ok) return result;
      totalFiles++;
    }

    for (const story of stories) {
      const storyPath = resolveEntityPath(story.filePath);
      const result = await writeFile(story, storyPath);
      if (!result.ok) return result;
      totalFiles++;
    }

    // 8. Save config
    const configResult = await saveConfig(metaDir, config);
    if (!configResult.ok) return configResult;
    totalFiles++;

    // 9. Save initial sync state
    const allEntities = [...milestones, ...epics, ...stories, roadmap];
    const syncState = createInitialState(
      site,
      projectKey,
      allEntities,
      boardId,
    );
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
      error:
        err instanceof Error ? err : new Error(`Jira import failed: ${err}`),
    };
  }
}
