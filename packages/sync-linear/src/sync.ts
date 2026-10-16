import type { Epic, Result, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import type { LinearIssue } from './client.js';
import { isNotFoundError, LinearClient } from './client.js';
import { loadConfig } from './config.js';
import { resolveConflicts } from './conflict.js';
import { computeRemoteIssueHash, diffByHash } from './diff.js';
import { mapLinearPriority, mapLinearState } from './mapper.js';
import { resolveEntityFilePath } from './paths.js';
import { createPushContext } from './push.js';
import { computeContentHash, loadState, saveState } from './state.js';
import type {
  FieldConflict,
  LinearConfig,
  LinearSyncOptions,
  LinearSyncStateEntry,
  SyncResult,
} from './types.js';

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
    const push = await createPushContext(client, teamId, config);

    const result: SyncResult = {
      pushed: { milestones: 0, issues: 0 },
      pulled: { milestones: 0, issues: 0 },
      conflicts: [],
      resolved: 0,
      skipped: 0,
      pulledPaths: [],
      pushedPaths: [],
    };

    const now = () => new Date().toISOString();

    /** Pushes the local entity and records both resulting hashes. */
    const pushLocal = async (
      entityId: string,
      entry: LinearSyncStateEntry,
      issueId: string,
      local: Story | Epic,
      localHash: string,
    ): Promise<void> => {
      const updated = await push.updateIssue(issueId, local);
      state.entities[entityId] = {
        ...entry,
        local_hash: localHash,
        remote_hash: computeRemoteIssueHash(updated, config),
        synced_at: now(),
      };
    };

    /** Overwrites the local entity with the remote issue and records hashes. */
    const pullRemote = async (
      entityId: string,
      entry: LinearSyncStateEntry,
      local: Story | Epic,
      remote: LinearIssue,
      remoteHash: string,
    ): Promise<void> => {
      applyRemoteIssue(local, remote, config);
      await writeFile(local, resolveEntityFilePath(metaDir, local.filePath));
      state.entities[entityId] = {
        ...entry,
        local_hash: computeContentHash(local),
        remote_hash: remoteHash,
        synced_at: now(),
      };
    };

    // 4. Build entity lookup maps
    const milestoneById = new Map(tree.milestones.map((m) => [m.id, m]));
    const epicById = new Map(tree.epics.map((e) => [e.id, e]));
    const storyById = new Map(tree.stories.map((s) => [s.id, s]));

    const epicIdToLinearId = new Map<string, string>();
    for (const epic of tree.epics) {
      const linearId =
        epic.linear?.issue_id ?? state.entities[epic.id]?.linear_issue_id;
      if (linearId) epicIdToLinearId.set(epic.id, linearId);
    }

    // 5. Process each entity in sync state
    for (const [entityId, entry] of Object.entries(state.entities)) {
      const localEntity =
        milestoneById.get(entityId) ??
        epicById.get(entityId) ??
        storyById.get(entityId);

      // Handle local deletion: close the Linear issue
      if (!localEntity) {
        if (!dryRun) {
          if (entry.linear_issue_id && push.completedStateId) {
            try {
              await client.updateIssue(entry.linear_issue_id, {
                stateId: push.completedStateId,
              });
            } catch (err) {
              // Already gone remotely means there is nothing left to close.
              if (!isNotFoundError(err)) throw err;
            }
          }
          delete state.entities[entityId];
        }
        if (entry.linear_issue_id) result.pushed.issues++;
        continue;
      }

      // Cycles are managed in Linear; their state is tracked, never diffed.
      if (localEntity.type === 'milestone' || !entry.linear_issue_id) continue;

      const currentLocalHash = computeContentHash(localEntity);
      const remoteIssue = await client.getIssue(entry.linear_issue_id);

      if (!remoteIssue) {
        // Linear confirmed the issue no longer exists
        if (!dryRun) {
          localEntity.status = 'cancelled';
          await writeFile(
            localEntity,
            resolveEntityFilePath(metaDir, localEntity.filePath),
          );
          const hash = computeContentHash(localEntity);
          state.entities[entityId] = {
            ...entry,
            local_hash: hash,
            remote_hash: hash,
            synced_at: now(),
          };
        }
        result.pulled.issues++;
        result.pulledPaths.push(localEntity.filePath);
        continue;
      }

      const currentRemoteHash = computeRemoteIssueHash(remoteIssue, config);
      const direction = diffByHash(currentLocalHash, currentRemoteHash, entry);

      if (direction === 'in_sync') continue;

      if (direction === 'local_changed') {
        if (!dryRun) {
          await pushLocal(
            entityId,
            entry,
            entry.linear_issue_id,
            localEntity,
            currentLocalHash,
          );
        }
        result.pushed.issues++;
        result.pushedPaths.push(localEntity.filePath);
        continue;
      }

      if (direction === 'remote_changed') {
        if (!dryRun) {
          await pullRemote(
            entityId,
            entry,
            localEntity,
            remoteIssue,
            currentRemoteHash,
          );
        }
        result.pulled.issues++;
        result.pulledPaths.push(localEntity.filePath);
        continue;
      }

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
      if (resolutions.length === 0) {
        result.conflicts.push(conflict);
        result.skipped++;
        continue;
      }

      if (!dryRun) {
        if (resolutions[0].pick === 'local') {
          await pushLocal(
            entityId,
            entry,
            entry.linear_issue_id,
            localEntity,
            currentLocalHash,
          );
        } else {
          await pullRemote(
            entityId,
            entry,
            localEntity,
            remoteIssue,
            currentRemoteHash,
          );
        }
      }
      result.resolved++;
    }

    // 6. Handle local entities with no sync state entry. Epics go first so
    //    stories created in this run can be parented to them.
    const newEntities: (Epic | Story)[] = [
      ...tree.epics.filter((e) => !(e.id in state.entities)),
      ...tree.stories.filter((s) => !(s.id in state.entities)),
    ];

    for (const entity of newEntities) {
      // Already linked to a Linear issue (e.g. state file stale or missing
      // this entry): reconcile by seeding state instead of creating a
      // duplicate issue.
      const linkedId = entity.linear?.issue_id;
      if (linkedId) {
        const remote = await client.getIssue(linkedId);
        if (remote) {
          state.entities[entity.id] = {
            linear_issue_id: remote.id,
            local_hash: computeContentHash(entity),
            remote_hash: computeRemoteIssueHash(remote, config),
            synced_at: now(),
          };
          if (entity.type === 'epic') {
            epicIdToLinearId.set(entity.id, remote.id);
          }
          continue;
        }
      }

      if (!dryRun) {
        const parentId =
          entity.type === 'story' && entity.epic_ref?.id
            ? epicIdToLinearId.get(entity.epic_ref.id)
            : undefined;
        const created = await push.createIssue(entity, parentId);

        entity.linear = {
          issue_id: created.id,
          identifier: created.identifier,
          team_id: teamId,
          last_sync_hash: computeContentHash(entity),
          synced_at: now(),
        };
        await writeFile(
          entity,
          resolveEntityFilePath(metaDir, entity.filePath),
        );
        if (entity.type === 'epic') {
          epicIdToLinearId.set(entity.id, created.id);
        }
        state.entities[entity.id] = {
          linear_issue_id: created.id,
          local_hash: computeContentHash(entity),
          remote_hash: computeRemoteIssueHash(created, config),
          synced_at: now(),
        };
      }
      result.pushed.issues++;
      result.pushedPaths.push(entity.filePath);
    }

    // 7. Save state
    if (!dryRun) {
      state.last_sync = now();
      const saveResult = await saveState(metaDir, state);
      if (!saveResult.ok) return saveResult;
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
  local.priority = mapLinearPriority(remote.priority);
  local.body = remote.description ?? '';
  local.labels = remote.labels.nodes.map((l) => l.name);

  if (local.type === 'story') {
    local.assignee = remote.assignee?.name ?? null;
  } else {
    local.owner = remote.assignee?.name ?? null;
  }
}
