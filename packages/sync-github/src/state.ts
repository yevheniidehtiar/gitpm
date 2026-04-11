import { createHash } from 'node:crypto';
import {
  access,
  writeFile as fsWriteFile,
  mkdir,
  readFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ParsedEntity, Result } from '@gitpm/core';
import { parseTree } from '@gitpm/core';
import type { SyncState, SyncStateEntry } from './types.js';

export async function loadState(metaDir: string): Promise<Result<SyncState>> {
  const statePath = join(metaDir, 'sync', 'github-state.json');
  try {
    await access(statePath);
  } catch {
    // JSON file doesn't exist — try to reconstruct from entity frontmatter
    return reconstructState(metaDir);
  }

  try {
    const raw = await readFile(statePath, 'utf-8');
    const state = JSON.parse(raw) as SyncState;
    return { ok: true, value: state };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to load sync state: ${err}`),
    };
  }
}

/**
 * Reconstruct sync state from entity `github:` frontmatter blocks.
 * Called when `github-state.json` is missing but entities may already
 * contain sync metadata from a previous export/import cycle.
 */
export async function reconstructState(
  metaDir: string,
): Promise<Result<SyncState>> {
  const treeResult = await parseTree(metaDir);
  if (!treeResult.ok) {
    return {
      ok: false,
      error: new Error(
        `Failed to reconstruct sync state: ${treeResult.error.message}`,
      ),
    };
  }

  const tree = treeResult.value;
  const allEntities: ParsedEntity[] = [
    ...tree.stories,
    ...tree.epics,
    ...tree.milestones,
    ...tree.prds,
  ];

  // Find repo from any entity with github metadata
  let repo = '';
  for (const entity of allEntities) {
    if ('github' in entity && entity.github?.repo) {
      repo = entity.github.repo;
      break;
    }
  }

  // If no entity has github metadata, return an empty state
  if (!repo) {
    const emptyState: SyncState = {
      repo: '',
      last_sync: new Date().toISOString(),
      entities: {},
    };
    return { ok: true, value: emptyState };
  }

  const entries: Record<string, SyncStateEntry> = {};

  for (const entity of allEntities) {
    if (entity.type === 'roadmap') continue;

    const id = 'id' in entity ? (entity as { id: string }).id : '';
    if (!id) continue;

    const gh = 'github' in entity ? entity.github : undefined;
    if (!gh) continue;

    // Pre-sync entities (imported or hand-written) may have no `last_sync_hash`
    // yet; treat absence as an empty baseline hash so diffByHash still works —
    // any local/remote change will compare unequal and be flagged as changed.
    const entry: SyncStateEntry = {
      local_hash: gh.last_sync_hash ?? '',
      remote_hash: gh.last_sync_hash ?? '',
      synced_at: gh.synced_at,
    };

    if (entity.type === 'milestone' && gh.milestone_id) {
      entry.github_milestone_number = gh.milestone_id;
    }
    if (
      (entity.type === 'story' || entity.type === 'epic') &&
      gh.issue_number
    ) {
      entry.github_issue_number = gh.issue_number;
    }
    if (entity.type !== 'prd' && gh.project_item_id) {
      entry.github_project_item_id = gh.project_item_id;
    }

    entries[id] = entry;
  }

  const now = new Date().toISOString();
  const state: SyncState = {
    repo,
    last_sync: now,
    entities: entries,
  };

  // Persist the reconstructed state so future loads are fast
  await saveState(metaDir, state);

  return { ok: true, value: state };
}

export async function saveState(
  metaDir: string,
  state: SyncState,
): Promise<Result<void>> {
  try {
    const statePath = join(metaDir, 'sync', 'github-state.json');
    await mkdir(dirname(statePath), { recursive: true });
    const json = JSON.stringify(state, null, 2);
    await fsWriteFile(statePath, `${json}\n`, 'utf-8');
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      error: new Error(`Failed to save sync state: ${err}`),
    };
  }
}

/**
 * Compute a deterministic content hash for an entity.
 * Includes only semantically meaningful fields (title, status, priority,
 * assignee/owner, labels, body). Ignores metadata like synced_at, filePath.
 */
export function computeContentHash(entity: ParsedEntity): string {
  const canonical = buildCanonicalObject(entity);
  const json = JSON.stringify(canonical);
  const hash = createHash('sha256').update(json).digest('hex');
  return `sha256:${hash}`;
}

function buildCanonicalObject(entity: ParsedEntity): Record<string, unknown> {
  const base: Record<string, unknown> = {
    title: entity.type === 'roadmap' ? entity.title : entity.title,
  };

  if (entity.type === 'story') {
    base.status = entity.status;
    base.priority = entity.priority;
    base.assignee = entity.assignee ?? null;
    base.labels = [...(entity.labels ?? [])].sort();
    base.body = normalizeWhitespace(entity.body);
  } else if (entity.type === 'epic') {
    base.status = entity.status;
    base.priority = entity.priority;
    base.owner = entity.owner ?? null;
    base.labels = [...(entity.labels ?? [])].sort();
    base.body = normalizeWhitespace(entity.body);
  } else if (entity.type === 'milestone') {
    base.status = entity.status;
    base.target_date = entity.target_date ?? null;
    base.body = normalizeWhitespace(entity.body);
  } else if (entity.type === 'prd') {
    base.status = entity.status;
    base.body = normalizeWhitespace(entity.body);
  }

  // Sort keys alphabetically
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(base).sort()) {
    sorted[key] = base[key];
  }
  return sorted;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

export function createInitialState(
  repo: string,
  entities: ParsedEntity[],
  projectNumber?: number,
): SyncState {
  const now = new Date().toISOString();
  const stateEntities: Record<string, SyncStateEntry> = {};

  for (const entity of entities) {
    if (entity.type === 'roadmap') continue;

    const hash = computeContentHash(entity);
    const id = 'id' in entity ? (entity as { id: string }).id : '';
    if (!id) continue;

    const entry: SyncStateEntry = {
      local_hash: hash,
      remote_hash: hash,
      synced_at: now,
    };

    if (entity.type === 'milestone' && entity.github?.milestone_id) {
      entry.github_milestone_number = entity.github.milestone_id;
    }
    if (
      (entity.type === 'story' || entity.type === 'epic') &&
      entity.github?.issue_number
    ) {
      entry.github_issue_number = entity.github.issue_number;
    }
    if (entity.type !== 'prd' && entity.github?.project_item_id) {
      entry.github_project_item_id = entity.github.project_item_id;
    }

    stateEntities[id] = entry;
  }

  return {
    repo,
    project_number: projectNumber,
    last_sync: now,
    entities: stateEntities,
  };
}
