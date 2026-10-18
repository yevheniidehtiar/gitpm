import { createHash } from 'node:crypto';
import { writeFile as fsWriteFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ParsedEntity, Result } from '@gitpm/core';
import { z } from 'zod';

export const BITBUCKET_STATE_FILE = 'bitbucket-state.json';

export const syncStateEntrySchema = z.object({
  bitbucket_issue_id: z.number().int().optional(),
  /** Bitbucket milestones have no writable id over REST 2.0; track by name. */
  bitbucket_milestone_name: z.string().optional(),
  local_hash: z.string(),
  remote_hash: z.string(),
  synced_at: z.string(),
});
export type SyncStateEntry = z.infer<typeof syncStateEntrySchema>;

export const syncStateSchema = z.object({
  workspace: z.string(),
  repo_slug: z.string(),
  last_sync: z.string(),
  entities: z.record(z.string(), syncStateEntrySchema),
});
export type SyncState = z.infer<typeof syncStateSchema>;

function statePath(metaDir: string): string {
  return join(metaDir, 'sync', BITBUCKET_STATE_FILE);
}

export async function loadState(metaDir: string): Promise<Result<SyncState>> {
  try {
    const raw = await readFile(statePath(metaDir), 'utf-8');
    const parsed = syncStateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return {
        ok: false,
        error: new Error(
          `Invalid Bitbucket sync state: ${z.prettifyError(parsed.error)}`,
        ),
      };
    }
    return { ok: true, value: parsed.data };
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
    const path = statePath(metaDir);
    await mkdir(dirname(path), { recursive: true });
    const json = JSON.stringify(state, null, 2);
    await fsWriteFile(path, `${json}\n`, 'utf-8');
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
    base.epic = entity.epic_ref?.id ?? null;
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

/**
 * Build a fresh state from the given entities. Core entities carry no
 * Bitbucket sync block, so the remote ids come in through `remoteIds`
 * (entity id → issue id or milestone name).
 */
export function createInitialState(
  workspace: string,
  repoSlug: string,
  entities: ParsedEntity[],
  remoteIds: Record<string, { issueId?: number; milestoneName?: string }> = {},
): SyncState {
  const now = new Date().toISOString();
  const stateEntities: Record<string, SyncStateEntry> = {};

  for (const entity of entities) {
    if (entity.type === 'roadmap') continue;
    const id = 'id' in entity ? entity.id : '';
    if (!id) continue;

    const hash = computeContentHash(entity);
    const entry: SyncStateEntry = {
      local_hash: hash,
      remote_hash: hash,
      synced_at: now,
    };
    const remote = remoteIds[id];
    if (remote?.issueId !== undefined)
      entry.bitbucket_issue_id = remote.issueId;
    if (remote?.milestoneName !== undefined) {
      entry.bitbucket_milestone_name = remote.milestoneName;
    }
    stateEntities[id] = entry;
  }

  return {
    workspace,
    repo_slug: repoSlug,
    last_sync: now,
    entities: stateEntities,
  };
}
