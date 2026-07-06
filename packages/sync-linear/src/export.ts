import { join } from 'node:path';
import type { Epic, Result, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import { LinearClient } from './client.js';
import { loadConfig } from './config.js';
import { entityToLinearIssue } from './mapper.js';
import { computeContentHash, loadState, saveState } from './state.js';
import type {
  ExportResult,
  LinearExportOptions,
  LinearSyncState,
} from './types.js';

/** Builds a workflow-state-type → state-id map for a team (fetched once per run). */
export async function buildStateIdMap(
  client: LinearClient,
  teamId: string,
): Promise<Record<string, string>> {
  const states = await client.listWorkflowStates(teamId);
  const map: Record<string, string> = {};
  for (const state of states) {
    if (!(state.type in map)) {
      map[state.type] = state.id;
    }
  }
  return map;
}

export async function exportToLinear(
  options: LinearExportOptions,
): Promise<Result<ExportResult>> {
  try {
    const { apiKey, teamId, metaDir, dryRun } = options;

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
    const state: LinearSyncState = stateResult.ok
      ? stateResult.value
      : {
          team_id: teamId,
          last_sync: new Date().toISOString(),
          entities: {},
        };

    const client = new LinearClient({ apiKey });
    const stateIdMap = await buildStateIdMap(client, teamId);
    const result: ExportResult = {
      created: { milestones: 0, issues: 0 },
      updated: { milestones: 0, issues: 0 },
      totalChanges: 0,
      exportedPaths: [],
    };

    // 4. Process epics and stories (milestones = cycles are typically
    //    managed on the Linear side, so we skip creating cycles)
    const allIssueEntities: (Epic | Story)[] = [...tree.epics, ...tree.stories];

    // Build epic id → linear issue id map for parent linking
    const epicIdToLinearId = new Map<string, string>();
    for (const epic of tree.epics) {
      const linearId =
        epic.linear?.issue_id ?? state.entities[epic.id]?.linear_issue_id;
      if (linearId) {
        epicIdToLinearId.set(epic.id, linearId);
      }
    }

    for (const entity of allIssueEntities) {
      const entityState = state.entities[entity.id];
      const issueId = entity.linear?.issue_id ?? entityState?.linear_issue_id;

      if (!issueId) {
        // New entity — create issue on Linear
        if (!dryRun) {
          const params = entityToLinearIssue(entity, config);

          let parentId: string | undefined;
          if (entity.type === 'story' && entity.epic_ref?.id) {
            parentId = epicIdToLinearId.get(entity.epic_ref.id);
          }

          const stateId = params.targetStateType
            ? stateIdMap[params.targetStateType]
            : undefined;

          const created = await client.createIssue({
            teamId,
            title: params.title,
            description: params.description,
            priority: params.priority,
            stateId,
            parentId,
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

          if (entity.type === 'epic') {
            epicIdToLinearId.set(entity.id, created.id);
          }

          const hash = computeContentHash(entity);
          state.entities[entity.id] = {
            linear_issue_id: created.id,
            local_hash: hash,
            remote_hash: hash,
            synced_at: new Date().toISOString(),
          };
          result.exportedPaths.push(entity.filePath);
        }
        result.created.issues++;
      } else {
        // Existing entity — check for local changes
        const currentHash = computeContentHash(entity);
        if (entityState && currentHash !== entityState.local_hash) {
          if (!dryRun) {
            const params = entityToLinearIssue(entity, config);
            const stateId = params.targetStateType
              ? stateIdMap[params.targetStateType]
              : undefined;

            await client.updateIssue(issueId, {
              title: params.title,
              description: params.description,
              priority: params.priority,
              stateId,
            });

            entity.linear = {
              ...entity.linear,
              issue_id: issueId,
              team_id: teamId,
              last_sync_hash: currentHash,
              synced_at: new Date().toISOString(),
            };
            const filePath = join(metaDir, '..', entity.filePath);
            await writeFile(entity, filePath);

            state.entities[entity.id] = {
              ...entityState,
              linear_issue_id: issueId,
              local_hash: currentHash,
              remote_hash: currentHash,
              synced_at: new Date().toISOString(),
            };
            result.exportedPaths.push(entity.filePath);
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
        if (!dryRun && entry.linear_issue_id) {
          const completedStateId = stateIdMap.completed;
          if (completedStateId) {
            await client.updateIssue(entry.linear_issue_id, {
              stateId: completedStateId,
            });
          }
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
        err instanceof Error ? err : new Error(`Linear export failed: ${err}`),
    };
  }
}
