import { createHash } from 'node:crypto';
import { writeFile as fsWriteFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ParsedEntity, Result } from '@gitpm/core';
import type { SyncState, SyncStateEntry } from './types.js';

export async function loadState(metaDir: string): Promise<Result<SyncState>> {
  try {
    const statePath = join(metaDir, 'sync', 'github-state.json');
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
