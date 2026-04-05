import { createHash } from 'node:crypto';
import { writeFile as fsWriteFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ParsedEntity, Result } from '@gitpm/core';
import type { SyncState, SyncStateEntry } from './types.js';

export async function loadState(metaDir: string): Promise<Result<SyncState>> {
  try {
    const statePath = join(metaDir, 'sync', 'gitlab-state.json');
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
    const statePath = join(metaDir, 'sync', 'gitlab-state.json');
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

export function computeContentHash(entity: ParsedEntity): string {
  const canonical = buildCanonicalObject(entity);
  const json = JSON.stringify(canonical);
  const hash = createHash('sha256').update(json).digest('hex');
  return `sha256:${hash}`;
}

function buildCanonicalObject(entity: ParsedEntity): Record<string, unknown> {
  const base: Record<string, unknown> = {
    title: entity.title,
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
  project: string,
  entities: ParsedEntity[],
  projectId?: number,
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

    if (entity.type === 'milestone' && entity.gitlab?.milestone_id) {
      entry.gitlab_milestone_id = entity.gitlab.milestone_id;
    }
    if (
      (entity.type === 'story' || entity.type === 'epic') &&
      entity.gitlab?.issue_iid
    ) {
      entry.gitlab_issue_iid = entity.gitlab.issue_iid;
    }
    if (entity.type === 'epic' && entity.gitlab?.epic_iid) {
      entry.gitlab_epic_iid = entity.gitlab.epic_iid;
    }

    stateEntities[id] = entry;
  }

  return {
    project,
    project_id: projectId,
    last_sync: now,
    entities: stateEntities,
  };
}
