import type { Epic, Result, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import { GitHubClient } from './client.js';
import { entityToGhIssue, milestoneToGhMilestone } from './mapper.js';
import { computeContentHash, loadState, saveState } from './state.js';
import type { ExportOptions, ExportResult, SyncState } from './types.js';

export async function exportToGitHub(
  options: ExportOptions,
): Promise<Result<ExportResult>> {
  try {
    const { token, repo, metaDir, dryRun } = options;
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      return {
        ok: false,
        error: new Error(
          `Invalid repo format: "${repo}". Expected "owner/repo".`,
        ),
      };
    }

    // 1. Parse local tree
    const treeResult = await parseTree(metaDir);
    if (!treeResult.ok) return treeResult;
    const tree = treeResult.value;

    // 2. Load sync state (may not exist for first export)
    const stateResult = await loadState(metaDir);
    const state: SyncState = stateResult.ok
      ? stateResult.value
      : {
          repo,
          project_number: options.projectNumber,
          last_sync: new Date().toISOString(),
          entities: {},
        };

    const client = new GitHubClient(token);
    const result: ExportResult = {
      created: { milestones: 0, issues: 0 },
      updated: { milestones: 0, issues: 0 },
      totalChanges: 0,
    };

    // 3. Process milestones
    for (const milestone of tree.milestones) {
      const entityState = state.entities[milestone.id];

      if (
        !milestone.github?.milestone_id &&
        !entityState?.github_milestone_number
      ) {
        // New milestone — create on GitHub
        if (!dryRun) {
          const params = milestoneToGhMilestone(milestone);
          const created = await client.createMilestone(owner, repoName, params);

          // Write back GitHub IDs to local file
          milestone.github = {
            milestone_id: created.number,
            repo,
            last_sync_hash: computeContentHash(milestone),
            synced_at: new Date().toISOString(),
          };
          await writeFile(milestone, milestone.filePath);

          // Update sync state
          const hash = computeContentHash(milestone);
          state.entities[milestone.id] = {
            github_milestone_number: created.number,
            local_hash: hash,
            remote_hash: hash,
            synced_at: new Date().toISOString(),
          };
        }
        result.created.milestones++;
      } else {
        // Existing milestone — check for local changes
        const msNumber =
          milestone.github?.milestone_id ??
          entityState?.github_milestone_number;
        if (!msNumber) continue;

        const currentHash = computeContentHash(milestone);
        if (entityState && currentHash !== entityState.local_hash) {
          // Local changed — push update
          if (!dryRun) {
            const params = milestoneToGhMilestone(milestone);
            await client.updateMilestone(owner, repoName, msNumber, params);

            milestone.github = {
              ...milestone.github,
              milestone_id: msNumber,
              repo,
              last_sync_hash: currentHash,
              synced_at: new Date().toISOString(),
            };
            await writeFile(milestone, milestone.filePath);

            state.entities[milestone.id] = {
              ...entityState,
              github_milestone_number: msNumber,
              local_hash: currentHash,
              remote_hash: currentHash,
              synced_at: new Date().toISOString(),
            };
          }
          result.updated.milestones++;
        }
      }
    }

    // 4. Process epics and stories
    const allIssueEntities: (Epic | Story)[] = [...tree.epics, ...tree.stories];

    // Build a map of milestone IDs → GitHub milestone numbers for assignin
    const milestoneIdToNumber = new Map<string, number>();
    for (const ms of tree.milestones) {
      const num =
        ms.github?.milestone_id ??
        state.entities[ms.id]?.github_milestone_number;
      if (num) {
        milestoneIdToNumber.set(ms.id, num);
      }
    }

    for (const entity of allIssueEntities) {
      const entityState = state.entities[entity.id];
      const issueNumber =
        entity.github?.issue_number ?? entityState?.github_issue_number;

      if (!issueNumber) {
        // New entity — create issue on GitHub
        if (!dryRun) {
          const params = entityToGhIssue(entity);

          // Resolve milestone number for epics
          if (entity.type === 'epic' && entity.milestone_ref?.id) {
            const msNum = milestoneIdToNumber.get(entity.milestone_ref.id);
            if (msNum) {
              params.milestone = msNum;
            }
          }

          const created = await client.createIssue(owner, repoName, {
            title: params.title,
            body: params.body,
            labels: params.labels,
            assignees: params.assignees,
            milestone: params.milestone,
          });

          // If issue should be closed, close it after creation
          if (params.state === 'closed') {
            await client.updateIssue(owner, repoName, created.number, {
              state: 'closed',
            });
          }

          // Write back GitHub metadata
          entity.github = {
            issue_number: created.number,
            repo,
            last_sync_hash: computeContentHash(entity),
            synced_at: new Date().toISOString(),
          };
          await writeFile(entity, entity.filePath);

          // Update sync state
          const hash = computeContentHash(entity);
          state.entities[entity.id] = {
            github_issue_number: created.number,
            local_hash: hash,
            remote_hash: hash,
            synced_at: new Date().toISOString(),
          };
        }
        result.created.issues++;
      } else {
        // Existing entity — check for local changes or state mismatch
        const currentHash = computeContentHash(entity);
        const params = entityToGhIssue(entity);

        // Resolve milestone for epics
        if (entity.type === 'epic' && entity.milestone_ref?.id) {
          const msNum = milestoneIdToNumber.get(entity.milestone_ref.id);
          if (msNum) {
            params.milestone = msNum;
          }
        }

        // Also detect state mismatches: entity may be done/cancelled locally
        // but GitHub issue is still open (e.g., imported as done, never pushed)
        const expectedState = params.state ?? 'open';
        const hashChanged =
          entityState && currentHash !== entityState.local_hash;
        const needsStateSync =
          expectedState === 'closed' &&
          entityState &&
          !entityState.closed_on_remote;

        if (hashChanged || needsStateSync) {
          if (!dryRun) {
            await client.updateIssue(owner, repoName, issueNumber, {
              title: params.title,
              body: params.body,
              state: params.state,
              labels: params.labels,
              assignees: params.assignees,
              milestone: params.milestone,
            });

            entity.github = {
              ...entity.github,
              issue_number: issueNumber,
              repo,
              last_sync_hash: currentHash,
              synced_at: new Date().toISOString(),
            };
            await writeFile(entity, entity.filePath);

            state.entities[entity.id] = {
              ...entityState,
              github_issue_number: issueNumber,
              local_hash: currentHash,
              remote_hash: currentHash,
              closed_on_remote: expectedState === 'closed' ? true : undefined,
              synced_at: new Date().toISOString(),
            };
          }
          result.updated.issues++;
        }
      }
    }

    // 5. Handle locally deleted entities (files in state but not in tree)
    const currentEntityIds = new Set([
      ...tree.milestones.map((m) => m.id),
      ...tree.epics.map((e) => e.id),
      ...tree.stories.map((s) => s.id),
      ...tree.prds.map((p) => p.id),
    ]);

    for (const [entityId, entry] of Object.entries(state.entities)) {
      if (!currentEntityIds.has(entityId)) {
        // Entity was deleted locally — close on GitHub
        if (!dryRun) {
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
        }
        // Remove from sync state
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
      error: err instanceof Error ? err : new Error(`Export failed: ${err}`),
    };
  }
}
