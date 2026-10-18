import type {
  BitbucketSync,
  Epic,
  ExportResult,
  Milestone,
  Result,
  Story,
} from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import type {
  BitbucketAuth,
  BitbucketClient,
  BitbucketError,
} from './client.js';
import { createBitbucketClient } from './client.js';
import type { BitbucketConfig } from './config.js';
import type { EpicLinkTarget } from './mapper.js';
import { entityToBbIssue } from './mapper.js';
import type { SyncState } from './state.js';
import { computeContentHash, loadState, saveState } from './state.js';
import type { CreateIssueParams } from './types.js';

export interface BitbucketExportOptions {
  auth: BitbucketAuth;
  workspace: string;
  repoSlug: string;
  /** REST 2.0 root; defaults to `config.base_url`, then DEFAULT_BASE_URL. */
  baseUrl?: string;
  metaDir: string;
  /** Loaded `.meta/sync/bitbucket-config.yaml`; export requires one. */
  config: BitbucketConfig;
  dryRun?: boolean;
  /** Injected for tests; built from `auth` and `baseUrl` when omitted. */
  client?: BitbucketClient;
}

export interface BitbucketPlannedChange {
  /** `link` ties a local milestone to an existing Bitbucket milestone. */
  action: 'create' | 'update' | 'close' | 'link';
  entityId: string;
  /** Absent for `close`: the entity no longer exists locally. */
  entityType?: 'milestone' | 'epic' | 'story';
  title?: string;
  issueId?: number;
  milestoneName?: string;
}

export interface BitbucketExportResult extends ExportResult {
  /** Every change made, or with `dryRun` every change that would be made. */
  changes: BitbucketPlannedChange[];
  /** Things export could not do, e.g. milestones missing on Bitbucket. */
  warnings: string[];
}

/** Throws on failure; exportToBitbucket catches it and returns a Result. */
function unwrap<T>(result: Result<T, BitbucketError>, action: string): T {
  if (!result.ok) {
    throw new Error(`Failed to ${action}: ${result.error.message}`);
  }
  return result.value;
}

/**
 * Create or update Bitbucket issues from `.meta/` stories and epics.
 *
 * REST 2.0 cannot create milestones or components, so local milestones are
 * linked to existing ones by name and missing milestones or epic components
 * are reported in `warnings` instead of created.
 */
export async function exportToBitbucket(
  options: BitbucketExportOptions,
): Promise<Result<BitbucketExportResult>> {
  const { workspace, repoSlug, metaDir, config, dryRun = false } = options;
  const client =
    options.client ??
    createBitbucketClient({
      auth: options.auth,
      baseUrl: options.baseUrl ?? config.base_url,
    });

  const treeResult = await parseTree(metaDir);
  if (!treeResult.ok) return treeResult;
  const tree = treeResult.value;

  const stateResult = await loadState(metaDir);
  const state: SyncState = stateResult.ok
    ? stateResult.value
    : {
        workspace,
        repo_slug: repoSlug,
        last_sync: new Date().toISOString(),
        entities: {},
      };
  if (state.workspace !== workspace || state.repo_slug !== repoSlug) {
    return {
      ok: false,
      error: new Error(
        `Bitbucket sync state belongs to ${state.workspace}/${state.repo_slug}, not ${workspace}/${repoSlug}`,
      ),
    };
  }

  const result: BitbucketExportResult = {
    created: { milestones: 0, issues: 0 },
    updated: { milestones: 0, issues: 0 },
    totalChanges: 0,
    exportedPaths: [],
    changes: [],
    warnings: [],
  };

  /** A sync block only counts when it points at the repository we export to. */
  const ownBlock = (block: BitbucketSync | null | undefined) =>
    block && block.workspace === workspace && block.repo_slug === repoSlug
      ? block
      : undefined;

  async function persist(
    entity: Story | Epic | Milestone,
    sync: Pick<BitbucketSync, 'issue_id' | 'milestone_name'>,
  ): Promise<void> {
    const hash = computeContentHash(entity);
    const now = new Date().toISOString();
    entity.bitbucket = {
      ...ownBlock(entity.bitbucket),
      ...sync,
      workspace,
      repo_slug: repoSlug,
      last_sync_hash: hash,
      synced_at: now,
    };
    const written = await writeFile(entity, entity.filePath);
    if (!written.ok) throw written.error;
    state.entities[entity.id] = {
      ...state.entities[entity.id],
      ...(sync.issue_id !== undefined && { bitbucket_issue_id: sync.issue_id }),
      ...(sync.milestone_name !== undefined && {
        bitbucket_milestone_name: sync.milestone_name,
      }),
      local_hash: hash,
      remote_hash: hash,
      synced_at: now,
    };
    result.exportedPaths.push(entity.filePath);
  }

  try {
    // 1. Milestones: link to existing Bitbucket milestones by name.
    const milestoneNameById = new Map<string, string>();
    if (tree.milestones.length > 0) {
      const remote = unwrap(
        await client.listMilestones(workspace, repoSlug),
        'list Bitbucket milestones',
      );
      const remoteNames = new Set(remote.map((m) => m.name));

      for (const milestone of tree.milestones) {
        const linked =
          ownBlock(milestone.bitbucket)?.milestone_name ??
          state.entities[milestone.id]?.bitbucket_milestone_name;
        const name = linked ?? milestone.title;
        if (!remoteNames.has(name)) {
          result.warnings.push(
            `Milestone "${name}" does not exist on Bitbucket and cannot be created over the API; create it in the repository settings and export again`,
          );
          continue;
        }
        milestoneNameById.set(milestone.id, name);
        if (linked === name && state.entities[milestone.id]) continue;

        result.changes.push({
          action: 'link',
          entityId: milestone.id,
          entityType: 'milestone',
          title: milestone.title,
          milestoneName: name,
        });
        result.updated.milestones++;
        if (!dryRun) await persist(milestone, { milestone_name: name });
      }
    }

    // 2. Components: epics link through components unless markers only.
    const usesComponents = config.epic_linkage !== 'body-marker';
    const linkedEpicIds = new Set(
      tree.stories.flatMap((s) => (s.epic_ref?.id ? [s.epic_ref.id] : [])),
    );
    const componentNames = new Set<string>();
    if (usesComponents && linkedEpicIds.size > 0) {
      const components = unwrap(
        await client.listComponents(workspace, repoSlug),
        'list Bitbucket components',
      );
      for (const c of components) componentNames.add(c.name);
    }
    const missingComponents = new Set<string>();

    const epicsById = new Map(tree.epics.map((e) => [e.id, e]));

    function buildParams(
      entity: Epic | Story,
      current?: Parameters<typeof entityToBbIssue>[3],
    ): CreateIssueParams {
      let epic: EpicLinkTarget | null = null;
      if (entity.type === 'story' && entity.epic_ref?.id) {
        const target = epicsById.get(entity.epic_ref.id);
        epic = target
          ? { id: target.id, title: target.title }
          : { id: entity.epic_ref.id, title: '' };
      }
      const params = entityToBbIssue(entity, config, epic, current);

      if (entity.type === 'epic') {
        // An epic's own component is not gitpm's to manage; leave it as is.
        delete params.component;
        const milestoneName = entity.milestone_ref?.id
          ? milestoneNameById.get(entity.milestone_ref.id)
          : undefined;
        if (milestoneName) params.milestone = { name: milestoneName };
      } else if (params.component) {
        const { name } = params.component;
        if (!name || !componentNames.has(name)) {
          // Bitbucket rejects unknown components and the API cannot create them.
          delete params.component;
          if (name && !missingComponents.has(name)) {
            missingComponents.add(name);
            result.warnings.push(
              `Component "${name}" does not exist on Bitbucket and cannot be created over the API; create it in the repository settings to link stories to that epic by component`,
            );
          }
        }
      }
      return params;
    }

    // 3. Epics, then stories.
    const issueEntities: (Epic | Story)[] = [...tree.epics, ...tree.stories];
    for (const entity of issueEntities) {
      const entry = state.entities[entity.id];
      const issueId =
        ownBlock(entity.bitbucket)?.issue_id ?? entry?.bitbucket_issue_id;

      if (issueId === undefined) {
        result.changes.push({
          action: 'create',
          entityId: entity.id,
          entityType: entity.type,
          title: entity.title,
        });
        result.created.issues++;
        if (dryRun) {
          buildParams(entity);
          continue;
        }
        const created = unwrap(
          await client.createIssue(workspace, repoSlug, buildParams(entity)),
          `create Bitbucket issue for ${entity.id}`,
        );
        await persist(entity, { issue_id: created.id });
        continue;
      }

      const hash = computeContentHash(entity);
      if (entry && entry.local_hash === hash) continue;

      result.changes.push({
        action: 'update',
        entityId: entity.id,
        entityType: entity.type,
        title: entity.title,
        issueId,
      });
      result.updated.issues++;
      if (dryRun) {
        buildParams(entity);
        continue;
      }
      const current = unwrap(
        await client.getIssue(workspace, repoSlug, issueId),
        `read Bitbucket issue #${issueId}`,
      );
      unwrap(
        await client.updateIssue(
          workspace,
          repoSlug,
          issueId,
          buildParams(entity, current),
        ),
        `update Bitbucket issue #${issueId}`,
      );
      await persist(entity, { issue_id: issueId });
    }

    // 4. Entities deleted locally: close their issues and forget them.
    const localIds = new Set<string>([
      ...tree.milestones.map((m) => m.id),
      ...issueEntities.map((e) => e.id),
      ...tree.prds.map((p) => p.id),
    ]);
    for (const [entityId, entry] of Object.entries(state.entities)) {
      if (localIds.has(entityId)) continue;
      if (entry.bitbucket_issue_id !== undefined) {
        result.changes.push({
          action: 'close',
          entityId,
          issueId: entry.bitbucket_issue_id,
        });
        if (!dryRun) {
          unwrap(
            await client.updateIssue(
              workspace,
              repoSlug,
              entry.bitbucket_issue_id,
              { state: 'closed' },
            ),
            `close Bitbucket issue #${entry.bitbucket_issue_id}`,
          );
        }
      }
      if (!dryRun) delete state.entities[entityId];
      result.totalChanges++;
    }

    result.totalChanges +=
      result.created.milestones +
      result.created.issues +
      result.updated.milestones +
      result.updated.issues;
  } catch (err) {
    // Keep what already reached Bitbucket so a rerun does not duplicate it.
    if (!dryRun) await saveState(metaDir, state);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err
          : new Error(`Bitbucket export failed: ${err}`),
    };
  }

  if (dryRun) return { ok: true, value: result };

  state.last_sync = new Date().toISOString();
  const saved = await saveState(metaDir, state);
  if (!saved.ok) return saved;
  return { ok: true, value: result };
}
