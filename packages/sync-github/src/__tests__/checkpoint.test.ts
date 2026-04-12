import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearCheckpoint,
  hasCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
} from '../checkpoint.js';
import type { SyncCheckpoint } from '../types.js';

describe('checkpoint', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-checkpoint-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const sampleCheckpoint: SyncCheckpoint = {
    startedAt: '2026-04-07T10:00:00Z',
    repo: 'test-org/test-repo',
    processedEntityIds: ['entity-001', 'entity-002', 'entity-003'],
    lastError: {
      entityId: 'entity-004',
      message: 'API rate limit exceeded',
    },
  };

  describe('hasCheckpoint', () => {
    it('returns false when no checkpoint exists', async () => {
      const result = await hasCheckpoint(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    it('returns true when a checkpoint exists', async () => {
      await saveCheckpoint(tmpDir, sampleCheckpoint);
      const result = await hasCheckpoint(tmpDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });
  });

  describe('saveCheckpoint / loadCheckpoint', () => {
    it('round-trips checkpoint through save and load', async () => {
      const saveResult = await saveCheckpoint(tmpDir, sampleCheckpoint);
      expect(saveResult.ok).toBe(true);

      const loadResult = await loadCheckpoint(tmpDir);
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok) {
        expect(loadResult.value.startedAt).toBe('2026-04-07T10:00:00Z');
        expect(loadResult.value.repo).toBe('test-org/test-repo');
        expect(loadResult.value.processedEntityIds).toEqual([
          'entity-001',
          'entity-002',
          'entity-003',
        ]);
        expect(loadResult.value.lastError).toEqual({
          entityId: 'entity-004',
          message: 'API rate limit exceeded',
        });
      }
    });

    it('saves checkpoint without lastError', async () => {
      const cp: SyncCheckpoint = {
        startedAt: '2026-04-07T10:00:00Z',
        repo: 'test-org/test-repo',
        processedEntityIds: ['entity-001'],
      };

      const saveResult = await saveCheckpoint(tmpDir, cp);
      expect(saveResult.ok).toBe(true);

      const loadResult = await loadCheckpoint(tmpDir);
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok) {
        expect(loadResult.value.lastError).toBeUndefined();
        expect(loadResult.value.processedEntityIds).toEqual(['entity-001']);
      }
    });

    it('returns error when loading from nonexistent directory', async () => {
      const result = await loadCheckpoint(join(tmpDir, 'nonexistent'));
      expect(result.ok).toBe(false);
    });

    it('overwrites existing checkpoint on save', async () => {
      await saveCheckpoint(tmpDir, sampleCheckpoint);

      const updated: SyncCheckpoint = {
        startedAt: '2026-04-07T11:00:00Z',
        repo: 'test-org/test-repo',
        processedEntityIds: [
          'entity-001',
          'entity-002',
          'entity-003',
          'entity-004',
        ],
      };
      await saveCheckpoint(tmpDir, updated);

      const loadResult = await loadCheckpoint(tmpDir);
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok) {
        expect(loadResult.value.processedEntityIds).toHaveLength(4);
        expect(loadResult.value.lastError).toBeUndefined();
      }
    });
  });

  describe('clearCheckpoint', () => {
    it('removes an existing checkpoint', async () => {
      await saveCheckpoint(tmpDir, sampleCheckpoint);

      const hasBefore = await hasCheckpoint(tmpDir);
      expect(hasBefore.ok && hasBefore.value).toBe(true);

      const clearResult = await clearCheckpoint(tmpDir);
      expect(clearResult.ok).toBe(true);

      const hasAfter = await hasCheckpoint(tmpDir);
      expect(hasAfter.ok).toBe(true);
      if (hasAfter.ok) {
        expect(hasAfter.value).toBe(false);
      }
    });

    it('succeeds even when no checkpoint exists', async () => {
      const result = await clearCheckpoint(tmpDir);
      expect(result.ok).toBe(true);
    });
  });
});
