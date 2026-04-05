import { join } from 'node:path';
import type { Epic, Milestone, ParsedEntity, Result, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import { GitLabClient } from './client.js';
import { loadConfig } from './config.js';
import { entityToGlIssue, milestoneToGlMilestone } from './mapper.js';
import { computeContentHash, loadState, saveState } from './state.js';
import type {
  ExportOptions,
  ExportResult,
  SyncState,
  SyncStateEntry,
} from './types.js';

export async function exportToGitLab(
  options: ExportOptions,
): Promise<Result<ExportResult>> {
  try {
    const { token, project, metaDir, dryRun } = options;
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

    // 2. Parse local tree
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) return treeResult;
    const tree = treeResult.value;

    // 3. Load sync state (may not exist for first export)
    const stateResult = await loadState(metaDir);
    const state: SyncState = stateResult.ok
      ? stateResult.value
      : {
          project,
          project_id: projectId,
          last_sync: new Date().toISOString(),
          entities: {},
        };

    const client = new GitLabClient(token, baseUrl);
    const result: ExportResult = {
      created: { milestones: 0, issues: 0 },
      updated: { milestones: 0, issues: 0 },
      totalChanges: 0,
    };

    // 4. Process milestones
    for (const milestone of tree.milestones) {
      const entityState = state.entities[milestone.id];

      if (
        !milestone.gitlab?.milestone_id &&
        !entityState?.gitlab_milestone_id
      ) {
        // New milestone — create on GitLab
        if (!dryRun) {
          const params = milestoneToGlMilestone(milestone);
          const created = await client.createMilestone(projectId, params);

          milestone.gitlab = {
            milestone_id: created.id,
            project_id: projectId,
            base_url: baseUrl,
            last_sync_hash: computeContentHash(milestone),
            synced_at: new Date().toISOString(),
          };
          const filePath = join(metaDir, '..', milestone.filePath);
          await writeFile(milestone, filePath);

          const hash = computeContentHash(milestone);
          state.entities[milestone.id] = {
            gitlab_milestone_id: created.id,
            local_hash: hash,
            remote_hash: hash,
            synced_at: new Date().toISOString(),
          };
        }
        result.created.milestones++;
      } else {
        // Existing milestone — check for local changes
        const msId =
          milestone.gitlab?.milestone_id ?? entityState?.gitlab_milestone_id;
        if (!msId) continue;

        const currentHash = computeContentHash(milestone);
        if (entityState && currentHash !== entityState.local_hash) {
          if (!dryRun) {
            const params = milestoneToGlMilestone(milestone);
            await client.updateMilestone(projectId, msId, params);

            milestone.gitlab = {
              ...milestone.gitlab,
              milestone_id: msId,
              project_id: projectId,
              base_url: baseUrl,
              last_sync_hash: currentHash,
              synced_at: new Date().toISOString(),
            };
            const filePath = join(metaDir, '..', milestone.filePath);
            await writeFile(milestone, filePath);

            state.entities[milestone.id] = {
              ...entityState,
              gitlab_milestone_id: msId,
              local_hash: currentHash,
              remote_hash: currentHash,
              synced_at: new Date().toISOString(),
            };
          }
          result.updated.milestones++;
        }
      }
    }

    // 5. Process epics and stories
    const allIssueEntities: (Epic | Story)[] = [...tree.epics, ...tree.stories];

    // Build milestone ID → GitLab milestone ID map
    const milestoneIdToGlId = new Map<string, number>();
    for (const ms of tree.milestones) {
      const num =
        ms.gitlab?.milestone_id ?? state.entities[ms.id]?.gitlab_milestone_id;
      if (num) {
        milestoneIdToGlId.set(ms.id, num);
      }
    }

    for (const entity of allIssueEntities) {
      const entityState = state.entities[entity.id];
      const issueIid =
        entity.gitlab?.issue_iid ?? entityState?.gitlab_issue_iid;

      if (!issueIid) {
        // New entity — create issue on GitLab
        if (!dryRun) {
          const params = entityToGlIssue(entity);

          // Resolve milestone for epics
          if (entity.type === 'epic' && entity.milestone_ref?.id) {
            const msGlId = milestoneIdToGlId.get(entity.milestone_ref.id);
            if (msGlId) {
              params.milestone_id = msGlId;
            }
          }

          const created = await client.createIssue(projectId, {
            title: params.title,
            description: params.description,
            labels: params.labels,
            milestone_id: params.milestone_id,
          });

          // If issue should be closed, close it after creation
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
        result.created.issues++;
      } else {
        // Existing entity — check for local changes
        const currentHash = computeContentHash(entity);
        if (entityState && currentHash !== entityState.local_hash) {
          if (!dryRun) {
            const params = entityToGlIssue(entity);

            if (entity.type === 'epic' && entity.milestone_ref?.id) {
              const msGlId = milestoneIdToGlId.get(entity.milestone_ref.id);
              if (msGlId) {
                params.milestone_id = msGlId;
              }
            }

            await client.updateIssue(projectId, issueIid, {
              title: params.title,
              description: params.description,
              state_event: params.state_event,
              labels: params.labels,
              milestone_id: params.milestone_id,
            });

            entity.gitlab = {
              ...entity.gitlab,
              issue_iid: issueIid,
              project_id: projectId,
              base_url: baseUrl,
              last_sync_hash: currentHash,
              synced_at: new Date().toISOString(),
            };
            const filePath = join(metaDir, '..', entity.filePath);
            await writeFile(entity, filePath);

            state.entities[entity.id] = {
              ...entityState,
              gitlab_issue_iid: issueIid,
              local_hash: currentHash,
              remote_hash: currentHash,
              synced_at: new Date().toISOString(),
            };
          }
          result.updated.issues++;
        }
      }
    }

    // 6. Handle locally deleted entities
    const currentEntityIds = new Set([
      ...tree.milestones.map((m) => m.id),
      ...tree.epics.map((e) => e.id),
      ...tree.stories.map((s) => s.id),
      ...tree.prds.map((p) => p.id),
    ]);

    for (const [entityId, entry] of Object.entries(state.entities)) {
      if (!currentEntityIds.has(entityId)) {
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

    // 7. Save updated sync state
    if (!dryRun) {
      state.last_sync = new Date().toISOString();
      await saveState(metaDir, state);
    }

    return { ok: true, value: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(`Export failed: ${err}`),
    };
  }
}
