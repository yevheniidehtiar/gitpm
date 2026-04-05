import { join } from 'node:path';
import type { Epic, Milestone, ParsedEntity, Result, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import { JiraClient } from './client.js';
import { loadConfig } from './config.js';
import { entityToJiraIssue } from './mapper.js';
import { computeContentHash, loadState, saveState } from './state.js';
import type {
  ExportResult,
  JiraExportOptions,
  JiraSyncState,
  JiraSyncStateEntry,
} from './types.js';

export async function exportToJira(
  options: JiraExportOptions,
): Promise<Result<ExportResult>> {
  try {
    const { email, apiToken, site, projectKey, metaDir, dryRun } = options;

    // 1. Parse local tree
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) return treeResult;
    const tree = treeResult.value;

    // 2. Load config
    const configResult = await loadConfig(metaDir);
    if (!configResult.ok) return configResult;
    const config = configResult.value;

    // 3. Load sync state (may not exist for first export)
    const stateResult = await loadState(metaDir);
    const state: JiraSyncState = stateResult.ok
      ? stateResult.value
      : {
          site,
          project_key: projectKey,
          last_sync: new Date().toISOString(),
          entities: {},
        };

    const client = new JiraClient({ site, email, apiToken });
    const result: ExportResult = {
      created: { milestones: 0, issues: 0 },
      updated: { milestones: 0, issues: 0 },
      totalChanges: 0,
    };

    // 4. Process epics and stories (milestones = sprints are typically
    //    managed on the Jira side, so we skip creating sprints)
    const allIssueEntities: (Epic | Story)[] = [...tree.epics, ...tree.stories];

    // Build epic id → jira key map for parent linking
    const epicIdToJiraKey = new Map<string, string>();
    for (const epic of tree.epics) {
      const jiraKey =
        epic.jira?.issue_key ?? state.entities[epic.id]?.jira_issue_key;
      if (jiraKey) {
        epicIdToJiraKey.set(epic.id, jiraKey);
      }
    }

    for (const entity of allIssueEntities) {
      const entityState = state.entities[entity.id];
      const issueKey = entity.jira?.issue_key ?? entityState?.jira_issue_key;

      if (!issueKey) {
        // New entity — create issue on Jira
        if (!dryRun) {
          const params = entityToJiraIssue(entity, config);

          // Resolve parent key for stories with epic_ref
          let parentKey: string | undefined;
          if (entity.type === 'story' && entity.epic_ref?.id) {
            parentKey = epicIdToJiraKey.get(entity.epic_ref.id);
          }

          const created = await client.createIssue({
            projectKey,
            summary: params.summary,
            issueType: params.issueType,
            description: params.description,
            labels: params.labels,
            priority: params.priority,
            parentKey,
          });

          // Transition to target status if needed
          if (params.targetStatus) {
            await transitionToStatus(client, created.key, params.targetStatus);
          }

          // Write back Jira metadata
          entity.jira = {
            issue_key: created.key,
            project_key: projectKey,
            site,
            last_sync_hash: computeContentHash(entity),
            synced_at: new Date().toISOString(),
          };
          const filePath = join(metaDir, '..', entity.filePath);
          await writeFile(entity, filePath);

          // Update epic key map for subsequent stories
          if (entity.type === 'epic') {
            epicIdToJiraKey.set(entity.id, created.key);
          }

          // Update sync state
          const hash = computeContentHash(entity);
          state.entities[entity.id] = {
            jira_issue_key: created.key,
            local_hash: hash,
            remote_hash: hash,
            synced_at: new Date().toISOString(),
          };
        }
        result.created.issues++;
      } else {
        // Existing entity — check for local changes
        const currentHash = computeContentHash(entity);
        if (entityState && currentHash !== entityState.local_hash) {
          if (!dryRun) {
            const params = entityToJiraIssue(entity, config);

            await client.updateIssue(issueKey, {
              summary: params.summary,
              description: params.description,
              labels: params.labels,
              priority: params.priority,
            });

            // Transition status if changed
            if (params.targetStatus) {
              await transitionToStatus(client, issueKey, params.targetStatus);
            }

            entity.jira = {
              ...entity.jira,
              issue_key: issueKey,
              project_key: projectKey,
              site,
              last_sync_hash: currentHash,
              synced_at: new Date().toISOString(),
            };
            const filePath = join(metaDir, '..', entity.filePath);
            await writeFile(entity, filePath);

            state.entities[entity.id] = {
              ...entityState,
              jira_issue_key: issueKey,
              local_hash: currentHash,
              remote_hash: currentHash,
              synced_at: new Date().toISOString(),
            };
          }
          result.updated.issues++;
        }
      }
    }

    // 5. Handle locally deleted entities
    const currentEntityIds = new Set([
      ...tree.milestones.map((m) => m.id),
      ...tree.epics.map((e) => e.id),
      ...tree.stories.map((s) => s.id),
      ...tree.prds.map((p) => p.id),
    ]);

    for (const [entityId, entry] of Object.entries(state.entities)) {
      if (!currentEntityIds.has(entityId)) {
        if (!dryRun && entry.jira_issue_key) {
          // Transition to a "Done" status to mark as closed
          await transitionToStatus(client, entry.jira_issue_key, 'Done');
        }
        delete state.entities[entityId];
        result.totalChanges++;
      }
    }

    result.totalChanges +=
      result.created.milestones +
      result.created.issues +
      result.updated.milestones +
      result.updated.issues;

    // 6. Save updated sync state
    if (!dryRun) {
      state.last_sync = new Date().toISOString();
      await saveState(metaDir, state);
    }

    return { ok: true, value: result };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err : new Error(`Jira export failed: ${err}`),
    };
  }
}

async function transitionToStatus(
  client: JiraClient,
  issueKey: string,
  targetStatusName: string,
): Promise<void> {
  try {
    const transitions = await client.getTransitions(issueKey);
    const match = transitions.find(
      (t) => t.to.name.toLowerCase() === targetStatusName.toLowerCase(),
    );
    if (match) {
      await client.transitionIssue(issueKey, match.id);
    }
  } catch {
    // Transition may not be available; skip silently
  }
}
