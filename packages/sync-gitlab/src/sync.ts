import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { Epic, Milestone, Result, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import type { GlIssue, GlMilestone } from './client.js';
import { GitLabClient } from './client.js';
import { loadConfig } from './config.js';
import { resolveConflicts } from './conflict.js';
import {
  diffByHash,
  remoteIssueFields,
  remoteMilestoneFields,
} from './diff.js';
import { entityToGlIssue, milestoneToGlMilestone } from './mapper.js';
import { computeContentHash, loadState, saveState } from './state.js';
import type { FieldConflict, SyncOptions, SyncResult } from './types.js';

function computeRemoteIssueHash(gl: GlIssue): string {
  const fields = remoteIssueFields(gl);
  const json = JSON.stringify(fields);
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}

function computeRemoteMilestoneHash(gl: GlMilestone): string {
  const fields = remoteMilestoneFields(gl);
  const json = JSON.stringify(fields);
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}

export async function syncWithGitLab(
  options: SyncOptions,
): Promise<Result<SyncResult>> {
  try {
    const { token, metaDir, strategy = 'ask', dryRun } = options;
    const baseUrl = options.baseUrl ?? 'https://gitlab.com';

    // 1. Load config to get project_id
    const configResult = await loadConfig(metaDir);
    if (!configResult.ok) {
      return {
        ok: false,
        error: new Error('No GitLab config found. Run import first.'),
      };
    }
    const config = configResult.value;
    const projectId = options.projectId ?? config.project_id;

    // 2. Load sync state
    const stateResult = await loadState(metaDir);
    if (!stateResult.ok) {
      return {
        ok: false,
        error: new Error('No sync state found. Run import or export first.'),
      };
    }
    const state = stateResult.value;

    // 3. Parse local tree
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) return treeResult;
    const tree = treeResult.value;

    const client = new GitLabClient(token, baseUrl);
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
        if (!dryRun) {
          if (entry.gitlab_issue_iid) {
            await client.updateIssue(projectId, entry.gitlab_issue_iid, {
              state_event: 'close',
            });
          }
          if (entry.gitlab_milestone_id) {
            await client.updateMilestone(projectId, entry.gitlab_milestone_id, {
              state_event: 'close',
            });
          }
          delete state.entities[entityId];
        }
        result.pushed.issues++;
        continue;
      }

      const currentLocalHash = computeContentHash(localEntity);

      // Milestones
      if (entry.gitlab_milestone_id && localEntity.type === 'milestone') {
        const remoteMilestone = await client.getMilestone(
          projectId,
          entry.gitlab_milestone_id,
        );

        if (!remoteMilestone) {
          if (!dryRun) {
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
          result.pulled.milestones++;
          continue;
        }

        const currentRemoteHash = computeRemoteMilestoneHash(remoteMilestone);
        const direction = diffByHash(
          currentLocalHash,
          currentRemoteHash,
          entry,
        );

        if (direction === 'in_sync') continue;

        if (direction === 'local_changed') {
          if (!dryRun) {
            const params = milestoneToGlMilestone(localEntity);
            await client.updateMilestone(
              projectId,
              entry.gitlab_milestone_id,
              params,
            );
            state.entities[entityId] = {
              ...entry,
              local_hash: currentLocalHash,
              remote_hash: currentLocalHash,
              synced_at: new Date().toISOString(),
            };
          }
          result.pushed.milestones++;
        } else if (direction === 'remote_changed') {
          if (!dryRun) {
            applyRemoteMilestone(localEntity, remoteMilestone);
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
          result.pulled.milestones++;
        } else {
          // Both changed — conflict
          const conflict: FieldConflict = {
            entityId,
            entityTitle: localEntity.title,
            entityType: 'milestone',
            field: '_all',
            baseValue: null,
            localValue: currentLocalHash,
            remoteValue: currentRemoteHash,
          };

          const resolutions = resolveConflicts([conflict], strategy);
          if (resolutions.length > 0) {
            const pick = resolutions[0].pick;
            if (!dryRun) {
              if (pick === 'local') {
                const params = milestoneToGlMilestone(localEntity);
                await client.updateMilestone(
                  projectId,
                  entry.gitlab_milestone_id,
                  params,
                );
                state.entities[entityId] = {
                  ...entry,
                  local_hash: currentLocalHash,
                  remote_hash: currentLocalHash,
                  synced_at: new Date().toISOString(),
                };
              } else {
                applyRemoteMilestone(localEntity, remoteMilestone);
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
      } else if (entry.gitlab_issue_iid) {
        // Issues (stories/epics)
        const remoteIssue = await client.getIssue(
          projectId,
          entry.gitlab_issue_iid,
        );

        if (!remoteIssue) {
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

        const currentRemoteHash = computeRemoteIssueHash(remoteIssue);
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
            const params = entityToGlIssue(localEntity);
            await client.updateIssue(projectId, entry.gitlab_issue_iid, {
              title: params.title,
              description: params.description,
              state_event: params.state_event,
              labels: params.labels,
            });
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
            applyRemoteIssue(localEntity, remoteIssue);
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
                const params = entityToGlIssue(localEntity);
                await client.updateIssue(projectId, entry.gitlab_issue_iid, {
                  title: params.title,
                  description: params.description,
                  state_event: params.state_event,
                  labels: params.labels,
                });
                state.entities[entityId] = {
                  ...entry,
                  local_hash: currentLocalHash,
                  remote_hash: currentLocalHash,
                  synced_at: new Date().toISOString(),
                };
              } else {
                applyRemoteIssue(localEntity, remoteIssue);
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
    const newEntities: (Epic | Story | Milestone)[] = [
      ...tree.milestones.filter((m) => !syncedIds.has(m.id)),
      ...tree.epics.filter((e) => !syncedIds.has(e.id)),
      ...tree.stories.filter((s) => !syncedIds.has(s.id)),
    ];

    for (const entity of newEntities) {
      if (entity.type === 'milestone') {
        if (!dryRun) {
          const params = milestoneToGlMilestone(entity);
          const created = await client.createMilestone(projectId, params);
          entity.gitlab = {
            milestone_id: created.id,
            project_id: projectId,
            base_url: baseUrl,
            last_sync_hash: computeContentHash(entity),
            synced_at: new Date().toISOString(),
          };
          const filePath = join(metaDir, '..', entity.filePath);
          await writeFile(entity, filePath);
          const hash = computeContentHash(entity);
          state.entities[entity.id] = {
            gitlab_milestone_id: created.id,
            local_hash: hash,
            remote_hash: hash,
            synced_at: new Date().toISOString(),
          };
        }
        result.pushed.milestones++;
      } else {
        if (!dryRun) {
          const params = entityToGlIssue(entity);
          const created = await client.createIssue(projectId, {
            title: params.title,
            description: params.description,
            labels: params.labels,
          });

          if (params.state_event === 'close') {
            await client.updateIssue(projectId, created.iid, {
              state_event: 'close',
            });
          }

          entity.gitlab = {
            issue_iid: created.iid,
            project_id: projectId,
            base_url: baseUrl,
            last_sync_hash: computeContentHash(entity),
            synced_at: new Date().toISOString(),
          };
          const filePath = join(metaDir, '..', entity.filePath);
          await writeFile(entity, filePath);
          const hash = computeContentHash(entity);
          state.entities[entity.id] = {
            gitlab_issue_iid: created.iid,
            local_hash: hash,
            remote_hash: hash,
            synced_at: new Date().toISOString(),
          };
        }
        result.pushed.issues++;
      }
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
      error: err instanceof Error ? err : new Error(`Sync failed: ${err}`),
    };
  }
}

function applyRemoteMilestone(local: Milestone, remote: GlMilestone): void {
  local.title = remote.title;
  local.status = remote.state === 'closed' ? 'done' : 'in_progress';
  local.target_date = remote.due_date ?? undefined;
  local.body = remote.description ?? '';
}

function applyRemoteIssue(local: Story | Epic, remote: GlIssue): void {
  local.title = remote.title;
  local.status = remote.state === 'closed' ? 'done' : 'todo';
  local.body = remote.description ?? '';
  local.labels = remote.labels.filter((l) => l !== 'epic');

  if (local.type === 'story') {
    local.assignee = remote.assignee?.username ?? null;
  } else {
    local.owner = remote.assignee?.username ?? null;
  }
}
