import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  BitbucketSync,
  ConflictStrategy,
  Epic,
  Resolution,
  Result,
  Story,
  SyncResult,
} from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import type { SyncCheckpoint } from './checkpoint.js';
import {
  clearCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
} from './checkpoint.js';
import type {
  BitbucketAuth,
  BitbucketClient,
  BitbucketError,
} from './client.js';
import { createBitbucketClient } from './client.js';
import type { BitbucketConfig } from './config.js';
import { mergeFields, resolveConflicts } from './conflict.js';
import type { SyncBaseline, SyncFields } from './diff.js';
import {
  diffSyncFields,
  fieldHashes,
  localFields,
  remoteFields,
} from './diff.js';
import type { EpicIssue } from './linker.js';
import { buildComponentIndex, resolveStoryEpic } from './linker.js';
import type { EpicLinkTarget } from './mapper.js';
import { bbKindToLabel, entityToBbIssue, mergeKindLabel } from './mapper.js';
import type { SyncState, SyncStateEntry } from './state.js';
import {
  BITBUCKET_STATE_FILE,
  computeContentHash,
  loadState,
  reconstructState,
  saveState,
} from './state.js';
import type { BbIssue, CreateIssueParams } from './types.js';

export interface BitbucketSyncOptions {
  auth: BitbucketAuth;
  workspace: string;
  repoSlug: string;
  /** REST 2.0 root; defaults to `config.base_url`, then DEFAULT_BASE_URL. */
  baseUrl?: string;
  metaDir: string;
  /** Loaded `.meta/sync/bitbucket-config.yaml`; sync requires one. */
  config: BitbucketConfig;
  strategy?: ConflictStrategy;
  dryRun?: boolean;
  /** Injected for tests; built from `auth` and `baseUrl` when omitted. */
  client?: BitbucketClient;
}

export interface BitbucketSyncResult extends SyncResult {
  /** True when this run skipped entities a failed earlier run finished. */
  resumedFromCheckpoint: boolean;
  /** Entities that failed; the checkpoint keeps the rest for the next run. */
  failedEntities: { entityId: string; error: string }[];
  /** Things sync could not do, e.g. components missing on Bitbucket. */
  warnings: string[];
}

type IssueEntity = Story | Epic;

/** Throws on failure; caught per entity or by syncWithBitbucket. */
function unwrap<T>(result: Result<T, BitbucketError>, action: string): T {
  if (!result.ok) {
    throw new Error(`Failed to ${action}: ${result.error.message}`);
  }
  return result.value;
}

/** Bitbucket timestamps carry microseconds; compare as epoch ms. */
function isAfter(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

async function loadOrReconstructState(
  metaDir: string,
  workspace: string,
  repoSlug: string,
): Promise<Result<SyncState>> {
  try {
    await access(join(metaDir, 'sync', BITBUCKET_STATE_FILE));
  } catch {
    const rebuilt = await reconstructState(metaDir, workspace, repoSlug);
    if (!rebuilt.ok) return rebuilt;
    if (Object.keys(rebuilt.value.entities).length === 0) {
      return {
        ok: false,
        error: new Error(
          'No Bitbucket sync state found. Run import or export first.',
        ),
      };
    }
    return rebuilt;
  }
  return loadState(metaDir);
}

/**
 * Bidirectional sync between `.meta/` and Bitbucket issues.
 *
 * Each linked story and epic gets a field-level three-way diff: a field
 * changed on one side is copied to the other, a field changed on both sides
 * is resolved by `strategy` (`ask` reports it in `conflicts` and leaves the
 * entity untouched). New local entities are created as issues, locally
 * deleted ones are closed, and issues deleted on Bitbucket cancel their
 * entity. A failure on one entity is recorded and the run goes on; a
 * checkpoint lets the next run skip what already succeeded.
 *
 * Per-field baselines are recorded by sync itself. Until an entity has one
 * (right after import, export or a state rebuild), only whole-entity change
 * is known: if both sides changed, every differing field is a conflict.
 *
 * When `bitbucket-state.json` is missing, the state is rebuilt from the
 * `bitbucket:` frontmatter blocks. Milestones are linked by name and cannot
 * be written over REST 2.0, so sync leaves them to import and export.
 */
export async function syncWithBitbucket(
  options: BitbucketSyncOptions,
): Promise<Result<BitbucketSyncResult>> {
  try {
    return await runSync(options);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err : new Error(`Bitbucket sync failed: ${err}`),
    };
  }
}

async function runSync(
  options: BitbucketSyncOptions,
): Promise<Result<BitbucketSyncResult>> {
  const {
    workspace,
    repoSlug,
    metaDir,
    config,
    strategy = 'ask',
    dryRun = false,
  } = options;
  const client =
    options.client ??
    createBitbucketClient({
      auth: options.auth,
      baseUrl: options.baseUrl ?? config.base_url,
    });

  const stateResult = await loadOrReconstructState(
    metaDir,
    workspace,
    repoSlug,
  );
  if (!stateResult.ok) return stateResult;
  const state = stateResult.value;
  if (state.workspace !== workspace || state.repo_slug !== repoSlug) {
    return {
      ok: false,
      error: new Error(
        `Bitbucket sync state belongs to ${state.workspace}/${state.repo_slug}, not ${workspace}/${repoSlug}`,
      ),
    };
  }

  const checkpointResult = await loadCheckpoint(metaDir);
  if (!checkpointResult.ok) return checkpointResult;
  const saved = checkpointResult.value;
  const checkpoint =
    saved && saved.workspace === workspace && saved.repo_slug === repoSlug
      ? saved
      : null;
  const processed = new Set(checkpoint?.processedEntityIds ?? []);

  const treeResult = await parseTree(metaDir);
  if (!treeResult.ok) return treeResult;
  const tree = treeResult.value;

  const issuesResult = await client.listIssues(workspace, repoSlug);
  if (!issuesResult.ok) {
    return {
      ok: false,
      error: new Error(
        `Failed to list Bitbucket issues: ${issuesResult.error.message}`,
      ),
    };
  }
  const remoteById = new Map(issuesResult.value.map((i) => [i.id, i]));

  const result: BitbucketSyncResult = {
    pushed: { milestones: 0, issues: 0 },
    pulled: { milestones: 0, issues: 0 },
    conflicts: [],
    resolved: 0,
    skipped: 0,
    pulledPaths: [],
    pushedPaths: [],
    resumedFromCheckpoint: checkpoint !== null,
    failedEntities: [],
    warnings: [],
  };

  /** A sync block only counts when it points at the repository we sync. */
  const ownBlock = (block: BitbucketSync | null | undefined) =>
    block && block.workspace === workspace && block.repo_slug === repoSlug
      ? block
      : undefined;

  const issueEntities: IssueEntity[] = [...tree.epics, ...tree.stories];
  const issueIdOf = (entity: IssueEntity) =>
    ownBlock(entity.bitbucket)?.issue_id ??
    state.entities[entity.id]?.bitbucket_issue_id;

  const epicsById = new Map(tree.epics.map((e) => [e.id, e]));
  const milestonesById = new Map(tree.milestones.map((m) => [m.id, m]));
  const epicIssues: EpicIssue[] = [];
  for (const epic of tree.epics) {
    const id = issueIdOf(epic);
    const issue = id === undefined ? undefined : remoteById.get(id);
    if (issue) epicIssues.push({ issue, epicId: epic.id });
  }
  const componentIndex = buildComponentIndex(epicIssues);
  const knownEpicIds = new Set(epicsById.keys());

  const remoteEpicOf = (entity: IssueEntity, issue: BbIssue) =>
    entity.type === 'story'
      ? resolveStoryEpic(
          issue,
          componentIndex,
          knownEpicIds,
          config.epic_linkage,
        )
      : null;

  let componentNames: Set<string> | undefined;
  const missingComponents = new Set<string>();

  /** Outgoing params; same rules as export for epics and missing components. */
  async function buildParams(
    entity: IssueEntity,
    current?: BbIssue,
  ): Promise<CreateIssueParams> {
    let epic: EpicLinkTarget | null = null;
    if (entity.type === 'story' && entity.epic_ref?.id) {
      const target = epicsById.get(entity.epic_ref.id);
      epic = { id: entity.epic_ref.id, title: target?.title ?? '' };
    }
    const params = entityToBbIssue(entity, config, epic, current);
    if (entity.type === 'epic') {
      // An epic's own component is not gitpm's to manage; leave it as is.
      delete params.component;
      const milestoneId = entity.milestone_ref?.id;
      const milestone = milestoneId ? milestonesById.get(milestoneId) : null;
      const milestoneName = milestone
        ? (ownBlock(milestone.bitbucket)?.milestone_name ??
          state.entities[milestone.id]?.bitbucket_milestone_name)
        : undefined;
      if (milestoneName) params.milestone = { name: milestoneName };
      return params;
    }
    if (!params.component) return params;

    componentNames ??= new Set(
      unwrap(
        await client.listComponents(workspace, repoSlug),
        'list Bitbucket components',
      ).map((c) => c.name),
    );
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
    return params;
  }

  /** Stamp the frontmatter block, write the file and record the new baseline. */
  async function persist(
    entity: IssueEntity,
    issueId: number,
    issue: BbIssue | undefined,
  ): Promise<void> {
    const hash = computeContentHash(entity);
    const now = new Date().toISOString();
    entity.bitbucket = {
      ...ownBlock(entity.bitbucket),
      issue_id: issueId,
      workspace,
      repo_slug: repoSlug,
      last_sync_hash: hash,
      synced_at: now,
    };
    const written = await writeFile(entity, entity.filePath);
    if (!written.ok) throw written.error;

    const local = localFields(entity, config);
    const entry: SyncStateEntry = {
      ...state.entities[entity.id],
      bitbucket_issue_id: issueId,
      local_hash: hash,
      remote_hash: hash,
      synced_at: now,
    };
    if (issue) {
      entry.field_hashes = {
        local: fieldHashes(local),
        remote: fieldHashes(
          remoteFields(issue, local, config, remoteEpicOf(entity, issue)),
        ),
      };
    } else {
      delete entry.field_hashes;
    }
    state.entities[entity.id] = entry;
  }

  function baselineFor(entity: IssueEntity, issue: BbIssue): SyncBaseline {
    const entry = state.entities[entity.id];
    if (entry?.field_hashes) return { kind: 'fields', ...entry.field_hashes };
    const block = ownBlock(entity.bitbucket);
    const baseHash = entry?.local_hash || block?.last_sync_hash;
    const syncedAt = entry?.synced_at ?? block?.synced_at;
    return {
      kind: 'whole',
      localChanged: !baseHash || computeContentHash(entity) !== baseHash,
      remoteChanged: !syncedAt || isAfter(issue.updated_on, syncedAt),
    };
  }

  /** Copy the merged fields that differ from the entity onto it. */
  function applyFields(entity: IssueEntity, merged: SyncFields): void {
    const current = localFields(entity, config);
    if (merged.title !== current.title) entity.title = merged.title;
    if (merged.status !== current.status) entity.status = merged.status;
    if (merged.priority !== current.priority) {
      entity.priority = merged.priority;
    }
    if (merged.assignee !== current.assignee) {
      if (entity.type === 'story') entity.assignee = merged.assignee;
      else entity.owner = merged.assignee;
    }
    if (merged.kind !== current.kind) {
      entity.labels = mergeKindLabel(
        entity.labels,
        bbKindToLabel(merged.kind, config),
        config,
      );
    }
    if (merged.body !== current.body) entity.body = merged.body;
    if (entity.type === 'story' && merged.epic !== current.epic) {
      entity.epic_ref = merged.epic ? { id: merged.epic } : null;
    }
  }

  async function createRemote(entity: IssueEntity): Promise<void> {
    result.pushed.issues++;
    result.pushedPaths.push(entity.filePath);
    const params = await buildParams(entity);
    if (dryRun) return;
    const created = unwrap(
      await client.createIssue(workspace, repoSlug, params),
      `create Bitbucket issue for ${entity.id}`,
    );
    await persist(entity, created.id, created);
  }

  async function syncEntity(entity: IssueEntity): Promise<void> {
    const issueId = issueIdOf(entity);
    if (issueId === undefined) return createRemote(entity);

    let issue = remoteById.get(issueId);
    if (!issue) {
      const fetched = await client.getIssue(workspace, repoSlug, issueId);
      if (!fetched.ok && fetched.error.status === 404) {
        // Deleted on Bitbucket: cancel locally rather than delete the file.
        if (entity.status === 'cancelled') return;
        result.pulled.issues++;
        result.pulledPaths.push(entity.filePath);
        if (dryRun) return;
        entity.status = 'cancelled';
        await persist(entity, issueId, undefined);
        return;
      }
      issue = unwrap(fetched, `read Bitbucket issue #${issueId}`);
    }

    const local = localFields(entity, config);
    const remote = remoteFields(
      issue,
      local,
      config,
      remoteEpicOf(entity, issue),
    );
    const baseline = baselineFor(entity, issue);
    const diff = diffSyncFields(entity, local, remote, baseline);

    let resolutions: Resolution[] = [];
    if (diff.conflicts.length > 0) {
      resolutions = resolveConflicts(diff.conflicts, strategy);
      if (resolutions.length < diff.conflicts.length) {
        result.conflicts.push(...diff.conflicts);
        result.skipped++;
        return;
      }
      result.resolved += resolutions.length;
    }

    const pull =
      diff.remoteChanges.length > 0 ||
      resolutions.some((r) => r.pick === 'remote');
    const push =
      diff.localChanges.length > 0 ||
      resolutions.some((r) => r.pick === 'local');

    if (!pull && !push) {
      // Upgrade a whole-entity baseline so the next run diffs per field.
      if (!dryRun && baseline.kind === 'whole') {
        await persist(entity, issueId, issue);
      }
      return;
    }

    if (pull) {
      result.pulled.issues++;
      result.pulledPaths.push(entity.filePath);
    }
    if (push) {
      result.pushed.issues++;
      result.pushedPaths.push(entity.filePath);
    }
    if (dryRun) return;

    applyFields(entity, mergeFields(local, remote, diff, resolutions));
    if (pull) entity.updated_at = new Date().toISOString();
    let latest = issue;
    if (push) {
      latest = unwrap(
        await client.updateIssue(
          workspace,
          repoSlug,
          issueId,
          await buildParams(entity, issue),
        ),
        `update Bitbucket issue #${issueId}`,
      );
    }
    await persist(entity, issueId, latest);
  }

  async function closeDeleted(entityId: string): Promise<void> {
    const entry = state.entities[entityId];
    if (entry?.bitbucket_issue_id !== undefined) {
      result.pushed.issues++;
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
  }

  async function step(entityId: string, run: () => Promise<void>) {
    if (processed.has(entityId)) return;
    try {
      await run();
      processed.add(entityId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failedEntities.push({
        entityId,
        error: await saveProgress(entityId, message),
      });
    }
  }

  async function saveProgress(
    entityId: string,
    message: string,
  ): Promise<string> {
    if (dryRun) return message;
    const next: SyncCheckpoint = {
      startedAt: checkpoint?.startedAt ?? new Date().toISOString(),
      workspace,
      repo_slug: repoSlug,
      processedEntityIds: [...processed],
      lastError: { entityId, message },
    };
    const written = await saveCheckpoint(metaDir, next);
    return written.ok
      ? message
      : `${message} (checkpoint save also failed: ${written.error.message})`;
  }

  // Epics first, so a story pushed in the same run sees its epic's issue.
  for (const entity of issueEntities) {
    await step(entity.id, () => syncEntity(entity));
  }

  const localIds = new Set<string>([
    ...tree.milestones.map((m) => m.id),
    ...issueEntities.map((e) => e.id),
    ...tree.prds.map((p) => p.id),
  ]);
  for (const entityId of Object.keys(state.entities)) {
    if (localIds.has(entityId)) continue;
    await step(entityId, () => closeDeleted(entityId));
  }

  if (dryRun) return { ok: true, value: result };

  state.last_sync = new Date().toISOString();
  const stateSaved = await saveState(metaDir, state);
  if (!stateSaved.ok) return stateSaved;
  if (result.failedEntities.length === 0) {
    const cleared = await clearCheckpoint(metaDir);
    if (!cleared.ok) return cleared;
  }
  return { ok: true, value: result };
}
