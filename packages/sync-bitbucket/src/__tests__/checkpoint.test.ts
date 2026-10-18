import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SyncCheckpoint } from '../checkpoint.js';
import {
  clearCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
} from '../checkpoint.js';

let metaDir: string;

beforeEach(async () => {
  metaDir = await mkdtemp(join(tmpdir(), 'gitpm-bb-checkpoint-'));
});

afterEach(async () => {
  await rm(metaDir, { recursive: true, force: true });
});

const checkpoint: SyncCheckpoint = {
  startedAt: '2026-10-01T00:00:00.000Z',
  workspace: 'acme',
  repo_slug: 'widgets',
  processedEntityIds: ['st_1'],
  lastError: { entityId: 'st_2', message: 'boom' },
};

describe('checkpoint', () => {
  it('returns null when there is no checkpoint', async () => {
    expect(await loadCheckpoint(metaDir)).toEqual({ ok: true, value: null });
  });

  it('round-trips and clears a checkpoint', async () => {
    expect((await saveCheckpoint(metaDir, checkpoint)).ok).toBe(true);
    expect(await loadCheckpoint(metaDir)).toEqual({
      ok: true,
      value: checkpoint,
    });

    expect((await clearCheckpoint(metaDir)).ok).toBe(true);
    expect(await loadCheckpoint(metaDir)).toEqual({ ok: true, value: null });
  });

  it('clears a missing checkpoint without error', async () => {
    expect((await clearCheckpoint(metaDir)).ok).toBe(true);
  });

  it.each([
    ['invalid JSON', '{'],
    ['a wrong shape', '{"workspace": 1}'],
  ])('rejects %s', async (_label, content) => {
    await mkdir(join(metaDir, '.gitpm'), { recursive: true });
    await writeFile(
      join(metaDir, '.gitpm/bitbucket-sync-checkpoint.json'),
      content,
    );
    const result = await loadCheckpoint(metaDir);
    expect(result.ok).toBe(false);
  });
});
