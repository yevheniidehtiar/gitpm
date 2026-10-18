import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type {
  BitbucketSync,
  Epic,
  ImportResult,
  Milestone,
  ParsedEntity,
  Result,
  Roadmap,
  Story,
} from '@gitpm/core';
import { parseTree, toSlug, writeFile } from '@gitpm/core';
import type {
  BitbucketAuth,
  BitbucketClient,
  BitbucketError,
} from './client.js';
import { createBitbucketClient } from './client.js';
import type { BitbucketConfig, EpicLinkage } from './config.js';
import { createDefaultConfig, saveConfig } from './config.js';
import type { EpicIssue, IssueEntityType } from './linker.js';
import {
  buildComponentIndex,
  classifyIssues,
  resolveStoryEpic,
} from './linker.js';
import { bbIssueToFields, labelsToBbKind } from './mapper.js';
import type { SyncState, SyncStateEntry } from './state.js';
import {
  BITBUCKET_STATE_FILE,
  computeContentHash,
  createInitialState,
  loadState,
  saveState,
  syncStateSchema,
} from './state.js';
import type { BbIssue } from './types.js';

export interface BitbucketImportOptions {
  auth: BitbucketAuth;
  workspace: string;
  repoSlug: string;
  /** REST 2.0 root; defaults to DEFAULT_BASE_URL. */
  baseUrl?: string;
  metaDir: string;
  /**
   * Existing `.meta/sync/bitbucket-config.yaml`, if any. Import writes a
   * default config when absent and keeps the user's mapping overrides when present.
   */
  config?: BitbucketConfig;
  /** Overrides `config.epic_linkage` for this run. */
  epicLinkage?: EpicLinkage;
  /** Injected for tests; built from `auth` and `baseUrl` when omitted. */
  client?: BitbucketClient;
}

type ImportedEntity = Milestone | Epic | Story;

/** Local state that lets a re-import reuse ids and paths instead of duplicating. */
interface Existing {
  byId: Map<string, ParsedEntity>;
  issueEntityIds: Map<number, string>;
  milestoneEntityIds: Map<string, string>;
  /** Relative `.meta/...` paths already taken on disk. */
  usedPaths: Set<string>;
  roadmap: Roadmap | undefined;
  state: SyncState | undefined;
}

function newId(): string {
  return randomBytes(9).toString('base64url');
}

function apiError(error: BitbucketError): Error {
  return new Error(error.message);
}

/** Bitbucket timestamps carry microseconds; normalise to ISO-8601 ms. */
function isoDate(value: string, fallback: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function metaRelative(metaDir: string, filePath: string): string {
  if (filePath.startsWith('.meta/')) return filePath;
  const rel = relative(metaDir, filePath).split(sep).join(posix.sep);
  return `.meta/${rel}`;
}

function metaAbsolute(metaDir: string, filePath: string): string {
  return join(metaDir, filePath.replace(/^\.meta\//, ''));
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadExisting(
  metaDir: string,
  workspace: string,
  repoSlug: string,
): Promise<Result<Existing>> {
  const existing: Existing = {
    byId: new Map(),
    issueEntityIds: new Map(),
    milestoneEntityIds: new Map(),
    usedPaths: new Set(),
    roadmap: undefined,
    state: undefined,
  };
  if (!(await exists(metaDir))) return { ok: true, value: existing };

  const tree = await parseTree(metaDir);
  if (!tree.ok) return tree;
  const all: ParsedEntity[] = [
    ...tree.value.milestones,
    ...tree.value.epics,
    ...tree.value.stories,
    ...tree.value.prds,
    ...tree.value.sprints,
  ];
  for (const entity of all) {
    const rel = metaRelative(metaDir, entity.filePath);
    existing.usedPaths.add(rel);
    existing.byId.set(entity.id, { ...entity, filePath: rel } as ParsedEntity);
  }
  const roadmap = tree.value.roadmaps[0];
  if (roadmap) {
    existing.roadmap = {
      ...roadmap,
      filePath: metaRelative(metaDir, roadmap.filePath),
    };
  }

  const remember = (entityId: string, sync: RemoteLink) => {
    if (sync.issue_id !== undefined) {
      existing.issueEntityIds.set(sync.issue_id, entityId);
    }
    if (sync.milestone_name !== undefined) {
      existing.milestoneEntityIds.set(sync.milestone_name, entityId);
    }
  };

  if (await exists(join(metaDir, 'sync', BITBUCKET_STATE_FILE))) {
    const state = await loadState(metaDir);
    if (!state.ok) return state;
    // State from another repository maps foreign issue ids: ignore it.
    if (
      state.value.workspace === workspace &&
      state.value.repo_slug === repoSlug
    ) {
      existing.state = state.value;
      for (const [entityId, entry] of Object.entries(state.value.entities)) {
        remember(entityId, {
          issue_id: entry.bitbucket_issue_id,
          milestone_name: entry.bitbucket_milestone_name,
        });
      }
    }
  }

  // Like export, a frontmatter block for this repository wins over the state.
  for (const entity of [
    ...tree.value.milestones,
    ...tree.value.epics,
    ...tree.value.stories,
  ]) {
    const block = ownBlock(entity.bitbucket, workspace, repoSlug);
    if (block) remember(entity.id, block);
  }
  return { ok: true, value: existing };
}

type RemoteLink = Pick<BitbucketSync, 'issue_id' | 'milestone_name'>;

/** A sync block only counts when it points at the repository we import from. */
function ownBlock(
  block: BitbucketSync | null | undefined,
  workspace: string,
  repoSlug: string,
): BitbucketSync | undefined {
  return block && block.workspace === workspace && block.repo_slug === repoSlug
    ? block
    : undefined;
}

/**
 * Stamp the `bitbucket:` block. An unchanged block is kept as is, so a no-op
 * re-import does not bump `synced_at`.
 */
function withSyncBlock<T extends ImportedEntity>(
  entity: T,
  link: RemoteLink,
  workspace: string,
  repoSlug: string,
  now: string,
): T {
  const previous = ownBlock(entity.bitbucket, workspace, repoSlug);
  const block: BitbucketSync = {
    ...previous,
    ...link,
    workspace,
    repo_slug: repoSlug,
    last_sync_hash: computeContentHash(entity),
    synced_at: previous?.synced_at ?? now,
  };
  const unchanged =
    previous &&
    previous.issue_id === block.issue_id &&
    previous.milestone_name === block.milestone_name &&
    previous.last_sync_hash === block.last_sync_hash;
  return {
    ...entity,
    bitbucket: unchanged ? previous : { ...block, synced_at: now },
  };
}

function existingOfType<T extends ImportedEntity['type']>(
  existing: Existing,
  id: string,
  type: T,
): Extract<ImportedEntity, { type: T }> | undefined {
  const entity = existing.byId.get(id);
  return entity?.type === type
    ? (entity as Extract<ImportedEntity, { type: T }>)
    : undefined;
}

/** Swap the kind label in place, keeping every non-kind label the user added. */
function mergeKindLabel(
  current: readonly string[] | undefined,
  kindLabel: string,
  config: BitbucketConfig,
): string[] {
  if (!current) return [kindLabel];
  const rest = new Set(labelsToBbKind(current, config).labels);
  const labels: string[] = [];
  let placed = false;
  for (const label of current) {
    if (rest.has(label)) labels.push(label);
    else if (!placed) {
      labels.push(kindLabel);
      placed = true;
    }
  }
  if (!placed) labels.push(kindLabel);
  return labels;
}

/** Pick a free `.meta/` path, suffixing the issue id on a slug collision. */
function claimPath(
  used: Set<string>,
  dir: string,
  title: string,
  fileName: (slug: string) => string,
  suffix: string,
): string {
  const slug = toSlug(title) || `issue-${suffix}`;
  let path = `${dir}/${fileName(slug)}`;
  if (used.has(path)) path = `${dir}/${fileName(`${slug}-${suffix}`)}`;
  used.add(path);
  return path;
}

/**
 * Import Bitbucket issues and milestones into `.meta/`, then write
 * `bitbucket-config.yaml` and `bitbucket-state.json`.
 *
 * Re-importing is idempotent: entities are matched to earlier imports through
 * the sync state, keep their id, path and local-only fields, and files whose
 * content would not change are not rewritten.
 */
export async function importFromBitbucket(
  options: BitbucketImportOptions,
): Promise<Result<ImportResult>> {
  try {
    return await runImport(options);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(`Import failed: ${err}`),
    };
  }
}

async function runImport(
  options: BitbucketImportOptions,
): Promise<Result<ImportResult>> {
  const { workspace, repoSlug, metaDir } = options;

  const configResult = options.config
    ? { ok: true as const, value: options.config }
    : createDefaultConfig(
        workspace,
        repoSlug,
        options.baseUrl ? { base_url: options.baseUrl } : {},
      );
  if (!configResult.ok) return configResult;
  const config: BitbucketConfig = {
    ...configResult.value,
    workspace,
    repo_slug: repoSlug,
  };
  const linkage = options.epicLinkage ?? config.epic_linkage;

  const client =
    options.client ??
    createBitbucketClient({
      auth: options.auth,
      baseUrl: options.baseUrl ?? config.base_url,
    });

  const bbMilestones = await client.listMilestones(workspace, repoSlug);
  if (!bbMilestones.ok)
    return { ok: false, error: apiError(bbMilestones.error) };
  const bbIssues = await client.listIssues(workspace, repoSlug);
  if (!bbIssues.ok) return { ok: false, error: apiError(bbIssues.error) };

  const existingResult = await loadExisting(metaDir, workspace, repoSlug);
  if (!existingResult.ok) return existingResult;
  const existing = existingResult.value;
  const now = new Date().toISOString();

  // Each candidate remembers the entity it was built from, so unchanged
  // entities are not rewritten. Bitbucket-sourced fields overwrite; local-only
  // fields (estimate, github block, extra labels) are kept.
  const candidates: { entity: ImportedEntity; previous?: ImportedEntity }[] =
    [];
  const remoteIds: Record<
    string,
    { issueId?: number; milestoneName?: string }
  > = {};

  // --- Milestones ---
  const milestones: Milestone[] = [];
  const milestoneIdsByName = new Map<string, string>();
  for (const bbMs of bbMilestones.value) {
    const id = existing.milestoneEntityIds.get(bbMs.name) ?? newId();
    const previous = existingOfType(existing, id, 'milestone');
    const milestone: Milestone = previous
      ? { ...previous, title: bbMs.name }
      : {
          type: 'milestone',
          id,
          title: bbMs.name,
          status: 'todo',
          created_at: now,
          updated_at: now,
          body: '',
          filePath: claimPath(
            existing.usedPaths,
            '.meta/roadmap/milestones',
            bbMs.name,
            (slug) => `${slug}.md`,
            String(bbMs.id),
          ),
        };
    milestones.push(milestone);
    milestoneIdsByName.set(bbMs.name, id);
    remoteIds[id] = { milestoneName: bbMs.name };
    candidates.push({ entity: milestone, previous });
  }

  // --- Classify issues and assign stable ids ---
  const knownTypes = new Map<number, IssueEntityType>();
  const entityIds = new Map<number, string>();
  for (const issue of bbIssues.value) {
    const id = existing.issueEntityIds.get(issue.id) ?? newId();
    entityIds.set(issue.id, id);
    const type = existing.byId.get(id)?.type;
    if (type === 'epic' || type === 'story') knownTypes.set(issue.id, type);
  }
  const epicIssueIds = classifyIssues(bbIssues.value, knownTypes, linkage);
  const idOf = (issue: BbIssue): string => entityIds.get(issue.id) as string;
  const issuesByEntityId = new Map(
    bbIssues.value.map((issue) => [idOf(issue), issue]),
  );

  // --- Epics ---
  const epics: Epic[] = [];
  const epicIssues: EpicIssue[] = [];
  for (const issue of bbIssues.value) {
    if (!epicIssueIds.has(issue.id)) continue;
    const id = idOf(issue);
    const previous = existingOfType(existing, id, 'epic');
    const fields = bbIssueToFields(issue, config);
    const milestoneId = issue.milestone
      ? milestoneIdsByName.get(issue.milestone.name)
      : undefined;
    const epic: Epic = {
      ...(previous ?? {
        type: 'epic',
        id,
        created_at: isoDate(issue.created_on, now),
        updated_at: isoDate(issue.updated_on, now),
        filePath: claimPath(
          existing.usedPaths,
          '.meta/epics',
          issue.title,
          (slug) => `${slug}/epic.md`,
          String(issue.id),
        ),
      }),
      title: fields.title,
      status: fields.status,
      priority: fields.priority,
      owner: fields.assignee,
      labels: mergeKindLabel(previous?.labels, fields.labels[0], config),
      milestone_ref: milestoneId
        ? { id: milestoneId }
        : (previous?.milestone_ref ?? null),
      body: fields.body,
    } as Epic;
    epics.push(epic);
    epicIssues.push({ issue, epicId: id });
    remoteIds[id] = { issueId: issue.id };
    candidates.push({ entity: epic, previous });
  }

  // --- Stories ---
  const componentIndex = buildComponentIndex(epicIssues);
  const epicPaths = new Map<string, string>();
  for (const entity of existing.byId.values()) {
    if (entity.type === 'epic') epicPaths.set(entity.id, entity.filePath);
  }
  for (const epic of epics) epicPaths.set(epic.id, epic.filePath);
  const knownEpicIds = new Set(epicPaths.keys());

  const stories: Story[] = [];
  for (const issue of bbIssues.value) {
    if (epicIssueIds.has(issue.id)) continue;
    const id = idOf(issue);
    const previous = existingOfType(existing, id, 'story');
    const fields = bbIssueToFields(issue, config);
    const epicId = resolveStoryEpic(
      issue,
      componentIndex,
      knownEpicIds,
      linkage,
    );
    const epicPath = epicId ? epicPaths.get(epicId) : undefined;
    const storyDir = epicPath
      ? `${posix.dirname(epicPath)}/stories`
      : '.meta/stories';
    const story: Story = {
      ...(previous ?? {
        type: 'story',
        id,
        estimate: null,
        created_at: isoDate(issue.created_on, now),
        updated_at: isoDate(issue.updated_on, now),
        filePath: claimPath(
          existing.usedPaths,
          storyDir,
          issue.title,
          (slug) => `${slug}.md`,
          String(issue.id),
        ),
      }),
      title: fields.title,
      status: fields.status,
      priority: fields.priority,
      assignee: fields.assignee,
      labels: mergeKindLabel(previous?.labels, fields.labels[0], config),
      epic_ref: epicId ? { id: epicId } : (previous?.epic_ref ?? null),
      body: fields.body,
    } as Story;
    stories.push(story);
    remoteIds[id] = { issueId: issue.id };
    candidates.push({ entity: story, previous });
  }

  // --- Write entities that changed ---
  const writtenPaths: string[] = [];
  for (const candidate of candidates) {
    const remote = remoteIds[candidate.entity.id];
    const entity = withSyncBlock(
      candidate.entity,
      {
        ...(remote?.issueId !== undefined && { issue_id: remote.issueId }),
        ...(remote?.milestoneName !== undefined && {
          milestone_name: remote.milestoneName,
        }),
      },
      workspace,
      repoSlug,
      now,
    );
    const { previous } = candidate;
    if (previous && isDeepStrictEqual(entity, previous)) continue;
    if (previous) {
      const issue = issuesByEntityId.get(entity.id);
      entity.updated_at = issue ? isoDate(issue.updated_on, now) : now;
    }
    const result = await writeFile(
      entity,
      metaAbsolute(metaDir, entity.filePath),
    );
    if (!result.ok) return result;
    writtenPaths.push(entity.filePath);
  }

  // --- Roadmap: create once, then only append new milestones ---
  const roadmap: Roadmap = existing.roadmap ?? {
    type: 'roadmap',
    id: newId(),
    title: 'Roadmap',
    description: `Imported from Bitbucket ${workspace}/${repoSlug}`,
    milestones: [],
    updated_at: now,
    filePath: '.meta/roadmap/roadmap.yaml',
  };
  const listed = new Set(roadmap.milestones.map((ref) => ref.id));
  const added = milestones.filter((ms) => !listed.has(ms.id));
  if (!existing.roadmap || added.length > 0) {
    roadmap.milestones = [
      ...roadmap.milestones,
      ...added.map((ms) => ({ id: ms.id })),
    ];
    roadmap.updated_at = now;
    const result = await writeFile(
      roadmap,
      metaAbsolute(metaDir, roadmap.filePath),
    );
    if (!result.ok) return result;
    writtenPaths.push(roadmap.filePath);
  }

  // --- Config and state ---
  const saved = await saveConfig(metaDir, config);
  if (!saved.ok) return saved;

  const imported: ImportedEntity[] = [...milestones, ...epics, ...stories];
  const state = mergeState(
    createInitialState(workspace, repoSlug, imported, remoteIds),
    existing.state,
  );
  const stateResult = await saveState(metaDir, state);
  if (!stateResult.ok) return stateResult;

  return {
    ok: true,
    value: {
      milestones: milestones.length,
      epics: epics.length,
      stories: stories.length,
      totalFiles: writtenPaths.length + 2,
      writtenPaths,
    },
  };
}

/**
 * Keep earlier entries that this import did not touch (e.g. exported entities
 * whose issue is gone) and their timestamps where nothing changed, so a
 * no-op re-import leaves the state file byte-identical.
 */
function mergeState(
  next: SyncState,
  previous: SyncState | undefined,
): SyncState {
  if (!previous) return syncStateSchema.parse(next);
  const entities: Record<string, SyncStateEntry> = { ...previous.entities };
  let changed = false;
  for (const [id, entry] of Object.entries(next.entities)) {
    const before = previous.entities[id];
    if (before && sameEntry(before, entry)) continue;
    entities[id] = entry;
    changed = true;
  }
  if (!changed) return previous;
  // Parse to give fresh and carried-over entries the same key order.
  return syncStateSchema.parse({ ...next, entities });
}

function sameEntry(a: SyncStateEntry, b: SyncStateEntry): boolean {
  return (
    a.bitbucket_issue_id === b.bitbucket_issue_id &&
    a.bitbucket_milestone_name === b.bitbucket_milestone_name &&
    a.local_hash === b.local_hash &&
    a.remote_hash === b.remote_hash
  );
}
