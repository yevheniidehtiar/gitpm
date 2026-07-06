import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { Epic, Result, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import type { LinearCycle, LinearIssue } from './client.js';
import { LinearClient } from './client.js';
import { loadConfig } from './config.js';
import { resolveConflicts } from './conflict.js';
import { diffByHash, remoteCycleFields, remoteIssueFields } from './diff.js';
import { buildStateIdMap } from './export.js';
import {
  entityToLinearIssue,
  mapLinearPriority,
  mapLinearState,
} from './mapper.js';
import { computeContentHash, loadState, saveState } from './state.js';
import type {
  FieldConflict,
  LinearConfig,
  LinearSyncOptions,
  SyncResult,
} from './types.js';

function computeRemoteIssueHash(
  issue: LinearIssue,
  config?: Pick<LinearConfig, 'status_mapping'>,
): string {
  const fields = remoteIssueFields(issue, config);
  const json = JSON.stringify(fields);
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}

function _computeRemoteCycleHash(cycle: LinearCycle): string {
  const fields = remoteCycleFields(cycle);
  const json = JSON.stringify(fields);
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}

export async function syncWithLinear(
  options: LinearSyncOptions,
): Promise<Result<SyncResult>> {
  try {
    const { apiKey, teamId, metaDir, strategy = 'ask', dryRun } = options;

    // 1. Load sync state
    const stateResult = await loadState(metaDir);
    if (!stateResult.ok) {
      return {
        ok: false,
        error: new Error(
          'No Linear sync state found. Run import or export first.',
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

    const client = new LinearClient({ apiKey });
    const stateIdMap = await buildStateIdMap(client, teamId);
    const result: SyncResult = {
      pushed: { milestones: 0, issues: 0 },
      pulled: { milestones: 0, issues: 0 },
      conflicts: [],
      resolved: 0,
      skipped: 0,
      pulledPaths: [],
      pushedPaths: [],
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
        if (!dryRun && entry.linear_issue_id) {
          const completedStateId = stateIdMap.completed;
          if (completedStateId) {
            try {
              await client.updateIssue(entry.linear_issue_id, {
                stateId: completedStateId,
              });
            } catch {
              // Skip if update fails
            }
          }
          delete state.entities[entityId];
        }
        result.pushed.issues++;
        continue;
      }

      const currentLocalHash = computeContentHash(localEntity);

      if (entry.linear_cycle_id && localEntity.type === 'milestone') {
        // Cycle-based sync is limited — cycles are typically managed in Linear.
        // We just track sync state but don't push cycle changes.
        continue;
      }

      if (entry.linear_issue_id) {
        const remoteIssue = await client.getIssue(entry.linear_issue_id);

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
          result.pulledPaths.push(localEntity.filePath);
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
            const params = entityToLinearIssue(localEntity, config);
            const stateId = params.targetStateType
              ? stateIdMap[params.targetStateType]
              : undefined;

            await client.updateIssue(entry.linear_issue_id, {
              title: params.title,
              description: params.description,
              priority: params.priority,
              stateId,
            });

            state.entities[entityId] = {
              ...entry,
              local_hash: currentLocalHash,
              remote_hash: currentLocalHash,
              synced_at: new Date().toISOString(),
            };
          }
          result.pushed.issues++;
          result.pushedPaths.push(localEntity.filePath);
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
          result.pulledPaths.push(localEntity.filePath);
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
                const params = entityToLinearIssue(localEntity, config);
                const stateId = params.targetStateType
                  ? stateIdMap[params.targetStateType]
                  : undefined;
                await client.updateIssue(entry.linear_issue_id, {
                  title: params.title,
                  description: params.description,
                  priority: params.priority,
                  stateId,
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
        const params = entityToLinearIssue(entity, config);
        const stateId = params.targetStateType
          ? stateIdMap[params.targetStateType]
          : undefined;

        const created = await client.createIssue({
          teamId,
          title: params.title,
          description: params.description,
          priority: params.priority,
          stateId,
        });

        entity.linear = {
          issue_id: created.id,
          identifier: created.identifier,
          team_id: teamId,
          last_sync_hash: computeContentHash(entity),
          synced_at: new Date().toISOString(),
        };
        const filePath = join(metaDir, '..', entity.filePath);
        await writeFile(entity, filePath);
        const hash = computeContentHash(entity);
        state.entities[entity.id] = {
          linear_issue_id: created.id,
          local_hash: hash,
          remote_hash: hash,
          synced_at: new Date().toISOString(),
        };
      }
      result.pushed.issues++;
      result.pushedPaths.push(entity.filePath);
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
      error:
        err instanceof Error ? err : new Error(`Linear sync failed: ${err}`),
    };
  }
}

function applyRemoteIssue(
  local: Story | Epic,
  remote: LinearIssue,
  config: Pick<LinearConfig, 'status_mapping'>,
): void {
  local.title = remote.title;
  local.status = mapLinearState(remote.state.type, config);
  local.body = remote.description ?? '';
  local.labels = remote.labels.nodes.map((l) => l.name);

  if (local.type === 'story') {
    local.assignee = remote.assignee?.name ?? null;
    local.priority = mapLinearPriority(remote.priority);
  } else {
    local.owner = remote.assignee?.name ?? null;
    local.priority = mapLinearPriority(remote.priority);
  }
}
