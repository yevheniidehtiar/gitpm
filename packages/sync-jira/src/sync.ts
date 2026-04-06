import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { Epic, Milestone, Result, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import type { JiraIssue, JiraSprint } from './client.js';
import { JiraClient } from './client.js';
import { loadConfig } from './config.js';
import { resolveConflicts } from './conflict.js';
import { diffByHash, remoteIssueFields, remoteSprintFields } from './diff.js';
import { entityToJiraIssue, mapJiraPriority, mapJiraStatus } from './mapper.js';
import { computeContentHash, loadState, saveState } from './state.js';
import type {
  FieldConflict,
  JiraConfig,
  JiraSyncOptions,
  JiraSyncState,
  SyncResult,
} from './types.js';

function computeRemoteIssueHash(
  issue: JiraIssue,
  config?: Pick<JiraConfig, 'status_mapping'>,
): string {
  const fields = remoteIssueFields(issue, config);
  const json = JSON.stringify(fields);
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}

function computeRemoteSprintHash(sprint: JiraSprint): string {
  const fields = remoteSprintFields(sprint);
  const json = JSON.stringify(fields);
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}

export async function syncWithJira(
  options: JiraSyncOptions,
): Promise<Result<SyncResult>> {
  try {
    const {
      email,
      apiToken,
      site,
      projectKey,
      metaDir,
      strategy = 'ask',
      dryRun,
    } = options;

    // 1. Load sync state
    const stateResult = await loadState(metaDir);
    if (!stateResult.ok) {
      return {
        ok: false,
        error: new Error(
          'No Jira sync state found. Run import or export first.',
        ),
      };
    }
    const state = stateResult.value;

    // 2. Load config
    const configResult = await loadConfig(metaDir);
    if (!configResult.ok) return configResult;
    const config = configResult.value;

    // 3. Parse local tree
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) return treeResult;
    const tree = treeResult.value;

    const client = new JiraClient({ site, email, apiToken });
    const result: SyncResult = {
      pushed: { milestones: 0, issues: 0 },
      pulled: { milestones: 0, issues: 0 },
      conflicts: [],
      resolved: 0,
      skipped: 0,
    };

    // 4. Build entity lookup maps
    const milestoneById = new Map(tree.milestones.map((m) => [m.id, m]));
    const epicById = new Map(tree.epics.map((e) => [e.id, e]));
    const storyById = new Map(tree.stories.map((s) => [s.id, s]));

    // 5. Process each entity in sync state
    for (const [entityId, entry] of Object.entries(state.entities)) {
      const localEntity =
        milestoneById.get(entityId) ??
        epicById.get(entityId) ??
        storyById.get(entityId);

      // Handle local deletion
      if (!localEntity) {
        if (!dryRun && entry.jira_issue_key) {
          // Transition to Done
          try {
            const transitions = await client.getTransitions(
              entry.jira_issue_key,
            );
            const doneTransition = transitions.find(
              (t) => t.to.name.toLowerCase() === 'done',
            );
            if (doneTransition) {
              await client.transitionIssue(
                entry.jira_issue_key,
                doneTransition.id,
              );
            }
          } catch {
            // Skip if transition fails
          }
          delete state.entities[entityId];
        }
        result.pushed.issues++;
        continue;
      }

      const currentLocalHash = computeContentHash(localEntity);

      if (entry.jira_sprint_id && localEntity.type === 'milestone') {
        // Sprint-based sync is limited — sprints are typically managed in Jira
        // We just track sync state but don't push sprint changes
        continue;
      }

      if (entry.jira_issue_key) {
        const remoteIssue = await client.getIssue(entry.jira_issue_key);

        if (!remoteIssue) {
          // Remote deleted
          if (
            !dryRun &&
            (localEntity.type === 'story' || localEntity.type === 'epic')
          ) {
            localEntity.status = 'cancelled';
            const filePath = join(metaDir, '..', localEntity.filePath);
            await writeFile(localEntity, filePath);
            const hash = computeContentHash(localEntity);
            state.entities[entityId] = {
              ...entry,
              local_hash: hash,
              remote_hash: hash,
              synced_at: new Date().toISOString(),
            };
          }
          result.pulled.issues++;
          continue;
        }

        const currentRemoteHash = computeRemoteIssueHash(remoteIssue, config);
        const direction = diffByHash(
          currentLocalHash,
          currentRemoteHash,
          entry,
        );

        if (direction === 'in_sync') continue;

        if (direction === 'local_changed') {
          if (
            !dryRun &&
            (localEntity.type === 'story' || localEntity.type === 'epic')
          ) {
            const params = entityToJiraIssue(localEntity, config);
            await client.updateIssue(entry.jira_issue_key, {
              summary: params.summary,
              description: params.description,
              labels: params.labels,
              priority: params.priority,
            });

            // Handle status transition
            if (params.targetStatus) {
              try {
                const transitions = await client.getTransitions(
                  entry.jira_issue_key,
                );
                const match = transitions.find(
                  (t) =>
                    t.to.name.toLowerCase() ===
                    params.targetStatus?.toLowerCase(),
                );
                if (match) {
                  await client.transitionIssue(entry.jira_issue_key, match.id);
                }
              } catch {
                // Skip transition if unavailable
              }
            }

            state.entities[entityId] = {
              ...entry,
              local_hash: currentLocalHash,
              remote_hash: currentLocalHash,
              synced_at: new Date().toISOString(),
            };
          }
          result.pushed.issues++;
        } else if (direction === 'remote_changed') {
          if (
            !dryRun &&
            (localEntity.type === 'story' || localEntity.type === 'epic')
          ) {
            applyRemoteIssue(localEntity, remoteIssue, config);
            const filePath = join(metaDir, '..', localEntity.filePath);
            await writeFile(localEntity, filePath);
            const hash = computeContentHash(localEntity);
            state.entities[entityId] = {
              ...entry,
              local_hash: hash,
              remote_hash: currentRemoteHash,
              synced_at: new Date().toISOString(),
            };
          }
          result.pulled.issues++;
        } else {
          // Both changed — conflict
          const conflict: FieldConflict = {
            entityId,
            entityTitle: localEntity.title,
            entityType: localEntity.type,
            field: '_all',
            baseValue: null,
            localValue: currentLocalHash,
            remoteValue: currentRemoteHash,
          };

          const resolutions = resolveConflicts([conflict], strategy);
          if (resolutions.length > 0) {
            const pick = resolutions[0].pick;
            if (
              !dryRun &&
              (localEntity.type === 'story' || localEntity.type === 'epic')
            ) {
              if (pick === 'local') {
                const params = entityToJiraIssue(localEntity, config);
                await client.updateIssue(entry.jira_issue_key, {
                  summary: params.summary,
                  description: params.description,
                  labels: params.labels,
                  priority: params.priority,
                });
                state.entities[entityId] = {
                  ...entry,
                  local_hash: currentLocalHash,
                  remote_hash: currentLocalHash,
                  synced_at: new Date().toISOString(),
                };
              } else {
                applyRemoteIssue(localEntity, remoteIssue, config);
                const filePath = join(metaDir, '..', localEntity.filePath);
                await writeFile(localEntity, filePath);
                const hash = computeContentHash(localEntity);
                state.entities[entityId] = {
                  ...entry,
                  local_hash: hash,
                  remote_hash: currentRemoteHash,
                  synced_at: new Date().toISOString(),
                };
              }
            }
            result.resolved++;
          } else {
            result.conflicts.push(conflict);
            result.skipped++;
          }
        }
      }
    }

    // 6. Handle new local entities (not in sync state)
    const syncedIds = new Set(Object.keys(state.entities));
    const newEntities: (Epic | Story)[] = [
      ...tree.epics.filter((e) => !syncedIds.has(e.id)),
      ...tree.stories.filter((s) => !syncedIds.has(s.id)),
    ];

    for (const entity of newEntities) {
      if (!dryRun) {
        const params = entityToJiraIssue(entity, config);
        const created = await client.createIssue({
          projectKey,
          summary: params.summary,
          issueType: params.issueType,
          description: params.description,
          labels: params.labels,
          priority: params.priority,
        });

        entity.jira = {
          issue_key: created.key,
          project_key: projectKey,
          site,
          last_sync_hash: computeContentHash(entity),
          synced_at: new Date().toISOString(),
        };
        const filePath = join(metaDir, '..', entity.filePath);
        await writeFile(entity, filePath);
        const hash = computeContentHash(entity);
        state.entities[entity.id] = {
          jira_issue_key: created.key,
          local_hash: hash,
          remote_hash: hash,
          synced_at: new Date().toISOString(),
        };
      }
      result.pushed.issues++;
    }

    // 7. Save state
    if (!dryRun) {
      state.last_sync = new Date().toISOString();
      await saveState(metaDir, state);
    }

    return { ok: true, value: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(`Jira sync failed: ${err}`),
    };
  }
}

function applyRemoteIssue(
  local: Story | Epic,
  remote: JiraIssue,
  config: Pick<JiraConfig, 'status_mapping'>,
): void {
  local.title = remote.fields.summary;
  local.status = mapJiraStatus(remote.fields.status.name, config);
  local.body = remote.fields.description ?? '';
  local.labels = [...remote.fields.labels];

  if (local.type === 'story') {
    local.assignee = remote.fields.assignee?.displayName ?? null;
    local.priority = mapJiraPriority(remote.fields.priority?.name);
  } else {
    local.owner = remote.fields.assignee?.displayName ?? null;
    local.priority = mapJiraPriority(remote.fields.priority?.name);
  }
}
