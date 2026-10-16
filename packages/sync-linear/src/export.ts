import type { Epic, Result, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import { LinearClient } from './client.js';
import { loadConfig } from './config.js';
import { computeRemoteIssueHash } from './diff.js';
import { resolveEntityFilePath } from './paths.js';
import { createPushContext } from './push.js';
import { computeContentHash, loadState, saveState } from './state.js';
import type {
  ExportResult,
  LinearExportOptions,
  LinearSyncState,
} from './types.js';

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
    const push = await createPushContext(client, teamId, config);

    const result: ExportResult = {
      created: { milestones: 0, issues: 0 },
      updated: { milestones: 0, issues: 0 },
      totalChanges: 0,
      exportedPaths: [],
    };

    // 4. Process epics and stories (milestones = cycles are managed on the
    //    Linear side, so we skip creating cycles). Epics come first so that
    //    stories created in the same run can be parented to them.
    const allIssueEntities: (Epic | Story)[] = [...tree.epics, ...tree.stories];

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
            synced_at: new Date().toISOString(),
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
            synced_at: new Date().toISOString(),
          };
          result.exportedPaths.push(entity.filePath);
        }
        result.created.issues++;
        continue;
      }

      // Existing entity — push when it changed locally, or when it has a
      // Linear id but no state entry (push is local → remote, so the local
      // copy is authoritative and the state entry is reseeded from it).
      const currentHash = computeContentHash(entity);
      if (entityState && currentHash === entityState.local_hash) continue;

      if (!dryRun) {
        const updated = await push.updateIssue(issueId, entity);

        entity.linear = {
          ...entity.linear,
          issue_id: issueId,
          team_id: teamId,
          last_sync_hash: currentHash,
          synced_at: new Date().toISOString(),
        };
        await writeFile(
          entity,
          resolveEntityFilePath(metaDir, entity.filePath),
        );

        state.entities[entity.id] = {
          ...entityState,
          linear_issue_id: issueId,
          local_hash: currentHash,
          remote_hash: computeRemoteIssueHash(updated, config),
          synced_at: new Date().toISOString(),
        };
        result.exportedPaths.push(entity.filePath);
      }
      result.updated.issues++;
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
        if (!dryRun && entry.linear_issue_id && push.completedStateId) {
          await client.updateIssue(entry.linear_issue_id, {
            stateId: push.completedStateId,
          });
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
      const saveResult = await saveState(metaDir, state);
      if (!saveResult.ok) return saveResult;
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
