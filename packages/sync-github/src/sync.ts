import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { Epic, Milestone, Result, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import {
  clearCheckpoint,
  hasCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
} from './checkpoint.js';
import type { GhIssue, GhMilestone } from './client.js';
import { GitHubClient } from './client.js';
import { resolveConflicts } from './conflict.js';
import {
  diffByHash,
  remoteIssueFields,
  remoteMilestoneFields,
} from './diff.js';
import { entityToGhIssue, milestoneToGhMilestone } from './mapper.js';
import { computeContentHash, loadState, saveState } from './state.js';
import type {
  FieldConflict,
  SyncCheckpoint,
  SyncOptions,
  SyncResult,
} from './types.js';

/**
 * Compute a hash of a remote GitHub issue for comparison with sync state.
 */
function computeRemoteIssueHash(gh: GhIssue): string {
  const fields = remoteIssueFields(gh);
  const json = JSON.stringify(fields);
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}

function computeRemoteMilestoneHash(gh: GhMilestone): string {
  const fields = remoteMilestoneFields(gh);
  const json = JSON.stringify(fields);
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}

export async function syncWithGitHub(
  options: SyncOptions,
): Promise<Result<SyncResult>> {
  try {
    const { token, repo, metaDir, strategy = 'ask', dryRun } = options;
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      return {
        ok: false,
        error: new Error(
          `Invalid repo format: "${repo}". Expected "owner/repo".`,
        ),
      };
    }

    // 1. Load sync state
    const stateResult = await loadState(metaDir);
    if (!stateResult.ok) {
      return {
        ok: false,
        error: new Error('No sync state found. Run import or export first.'),
      };
    }
    const state = stateResult.value;

    // 2. Load checkpoint if present (for resume)
    let checkpoint: SyncCheckpoint | null = null;
    let resumedFromCheckpoint = false;
    const hasExisting = await hasCheckpoint(metaDir);
    if (!hasExisting.ok) {
      return {
        ok: false,
        error: new Error(
          `Failed to check for sync checkpoint: ${hasExisting.error.message}`,
        ),
      };
    }
    if (hasExisting.value) {
      const cpResult = await loadCheckpoint(metaDir);
      if (cpResult.ok && cpResult.value.repo === repo) {
        checkpoint = cpResult.value;
        resumedFromCheckpoint = true;
      }
    }

    const processedEntityIds = new Set<string>(
      checkpoint?.processedEntityIds ?? [],
    );

    // 3. Parse local tree
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) return treeResult;
    const tree = treeResult.value;

    const client = new GitHubClient(token);
    const result: SyncResult = {
      pushed: { milestones: 0, issues: 0 },
      pulled: { milestones: 0, issues: 0 },
      conflicts: [],
      resolved: 0,
      skipped: 0,
      resumedFromCheckpoint,
      failedEntities: [],
    };

    // Helper to save checkpoint on failure (skipped during dry runs)
    const saveProgress = async (
      failedEntityId: string,
      errorMessage: string,
    ): Promise<string> => {
      if (dryRun) return errorMessage;
      const cp: SyncCheckpoint = {
        startedAt: checkpoint?.startedAt ?? new Date().toISOString(),
        repo,
        processedEntityIds: [...processedEntityIds],
        lastError: { entityId: failedEntityId, message: errorMessage },
      };
      const saveResult = await saveCheckpoint(metaDir, cp);
      if (!saveResult.ok) {
        return `${errorMessage} (checkpoint save also failed: ${saveResult.error.message})`;
      }
      return errorMessage;
    };

    // 4. Build entity lookup maps
    const milestoneById = new Map(tree.milestones.map((m) => [m.id, m]));
    const epicById = new Map(tree.epics.map((e) => [e.id, e]));
    const storyById = new Map(tree.stories.map((s) => [s.id, s]));

    // 5. Process each entity in sync state
    for (const [entityId, entry] of Object.entries(state.entities)) {
      // Skip already-processed entities when resuming
      if (processedEntityIds.has(entityId)) continue;

      try {
        const localEntity =
          milestoneById.get(entityId) ??
          epicById.get(entityId) ??
          storyById.get(entityId);

        // Handle local deletion
        if (!localEntity) {
          if (!dryRun) {
            // Close on GitHub
            if (entry.github_issue_number) {
              await client.updateIssue(
                owner,
                repoName,
                entry.github_issue_number,
                {
                  state: 'closed',
                },
              );
            }
            if (entry.github_milestone_number) {
              await client.updateMilestone(
                owner,
                repoName,
                entry.github_milestone_number,
                { state: 'closed' },
              );
            }
            delete state.entities[entityId];
          }
          result.pushed.issues++;
          processedEntityIds.add(entityId);
          continue;
        }

        const currentLocalHash = computeContentHash(localEntity);

        // Fetch current remote state
        if (entry.github_milestone_number && localEntity.type === 'milestone') {
          const remoteMilestone = await client.getMilestone(
            owner,
            repoName,
            entry.github_milestone_number,
          );

          if (!remoteMilestone) {
            // Remote deleted — update local status
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
            processedEntityIds.add(entityId);
            continue;
          }

          const currentRemoteHash = computeRemoteMilestoneHash(remoteMilestone);
          const direction = diffByHash(
            currentLocalHash,
            currentRemoteHash,
            entry,
          );

          if (direction === 'in_sync') {
            processedEntityIds.add(entityId);
            continue;
          }

          if (direction === 'local_changed') {
            // Push local → remote
            if (!dryRun) {
              const params = milestoneToGhMilestone(localEntity);
              await client.updateMilestone(
                owner,
                repoName,
                entry.github_milestone_number,
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
            // Pull remote → local
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
                  const params = milestoneToGhMilestone(localEntity);
                  await client.updateMilestone(
                    owner,
                    repoName,
                    entry.github_milestone_number,
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
        } else if (entry.github_issue_number) {
          const remoteIssue = await client.getIssue(
            owner,
            repoName,
            entry.github_issue_number,
          );

          if (!remoteIssue) {
            // Remote deleted/closed — update local status
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
            processedEntityIds.add(entityId);
            continue;
          }

          const currentRemoteHash = computeRemoteIssueHash(remoteIssue);
          const direction = diffByHash(
            currentLocalHash,
            currentRemoteHash,
            entry,
          );

          if (direction === 'in_sync') {
            processedEntityIds.add(entityId);
            continue;
          }

          if (direction === 'local_changed') {
            if (
              !dryRun &&
              (localEntity.type === 'story' || localEntity.type === 'epic')
            ) {
              const params = entityToGhIssue(localEntity);
              await client.updateIssue(
                owner,
                repoName,
                entry.github_issue_number,
                {
                  title: params.title,
                  body: params.body,
                  state: params.state,
                  labels: params.labels,
                  assignees: params.assignees,
                },
              );
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
                  const params = entityToGhIssue(localEntity);
                  await client.updateIssue(
                    owner,
                    repoName,
                    entry.github_issue_number,
                    {
                      title: params.title,
                      body: params.body,
                      state: params.state,
                      labels: params.labels,
                      assignees: params.assignees,
                    },
                  );
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

        processedEntityIds.add(entityId);
      } catch (entityErr) {
        const errorMessage =
          entityErr instanceof Error
            ? entityErr.message
            : `Failed to sync entity: ${entityErr}`;
        const finalError = await saveProgress(entityId, errorMessage);
        result.failedEntities.push({ entityId, error: finalError });
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
      // Skip already-processed entities when resuming
      if (processedEntityIds.has(entity.id)) continue;

      try {
        if (entity.type === 'milestone') {
          if (!dryRun) {
            const params = milestoneToGhMilestone(entity);
            const created = await client.createMilestone(
              owner,
              repoName,
              params,
            );
            entity.github = {
              milestone_id: created.number,
              repo,
              last_sync_hash: computeContentHash(entity),
              synced_at: new Date().toISOString(),
            };
            const filePath = join(metaDir, '..', entity.filePath);
            await writeFile(entity, filePath);
            const hash = computeContentHash(entity);
            state.entities[entity.id] = {
              github_milestone_number: created.number,
              local_hash: hash,
              remote_hash: hash,
              synced_at: new Date().toISOString(),
            };
          }
          result.pushed.milestones++;
        } else {
          if (!dryRun) {
            const params = entityToGhIssue(entity);
            const created = await client.createIssue(owner, repoName, {
              title: params.title,
              body: params.body,
              labels: params.labels,
              assignees: params.assignees,
            });

            if (params.state === 'closed') {
              await client.updateIssue(owner, repoName, created.number, {
                state: 'closed',
              });
            }

            entity.github = {
              issue_number: created.number,
              repo,
              last_sync_hash: computeContentHash(entity),
              synced_at: new Date().toISOString(),
            };
            const filePath = join(metaDir, '..', entity.filePath);
            await writeFile(entity, filePath);
            const hash = computeContentHash(entity);
            state.entities[entity.id] = {
              github_issue_number: created.number,
              local_hash: hash,
              remote_hash: hash,
              synced_at: new Date().toISOString(),
            };
          }
          result.pushed.issues++;
        }

        processedEntityIds.add(entity.id);
      } catch (entityErr) {
        const errorMessage =
          entityErr instanceof Error
            ? entityErr.message
            : `Failed to sync entity: ${entityErr}`;
        const finalError = await saveProgress(entity.id, errorMessage);
        result.failedEntities.push({
          entityId: entity.id,
          error: finalError,
        });
      }
    }

    // 7. Save state and clear checkpoint on success
    if (!dryRun) {
      state.last_sync = new Date().toISOString();
      await saveState(metaDir, state);
    }

    // Only clear checkpoint if there were no failures and this is not a dry run
    if (!dryRun && result.failedEntities.length === 0) {
      await clearCheckpoint(metaDir);
    }

    return { ok: true, value: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(`Sync failed: ${err}`),
    };
  }
}

/**
 * Apply remote milestone data to a local milestone entity.
 */
function applyRemoteMilestone(local: Milestone, remote: GhMilestone): void {
  local.title = remote.title;
  local.status = remote.state === 'closed' ? 'done' : 'in_progress';
  local.target_date = remote.due_on ?? undefined;
  local.body = remote.description ?? '';
}

/**
 * Apply remote issue data to a local story or epic entity.
 */
function applyRemoteIssue(local: Story | Epic, remote: GhIssue): void {
  local.title = remote.title;
  local.status = remote.state === 'closed' ? 'done' : 'todo';
  local.body = remote.body ?? '';
  local.labels = remote.labels
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter((l) => l !== 'epic');

  if (local.type === 'story') {
    local.assignee = remote.assignee?.login ?? null;
  } else {
    local.owner = remote.assignee?.login ?? null;
  }
}
