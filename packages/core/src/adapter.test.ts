import { describe, expect, it } from 'vitest';
import { isSyncAdapter } from './adapter.js';
import type {
  AdapterExportOptions,
  AdapterImportOptions,
  AdapterSyncOptions,
  SyncAdapter,
} from './adapter.js';

function createMockAdapter(overrides: Partial<SyncAdapter> = {}): SyncAdapter {
  return {
    name: 'test',
    displayName: 'Test Adapter',
    detect: async () => false,
    import: async (_options: AdapterImportOptions) => ({
      ok: true as const,
      value: { milestones: 0, epics: 0, stories: 0, totalFiles: 0 },
    }),
    export: async (_options: AdapterExportOptions) => ({
      ok: true as const,
      value: {
        created: { milestones: 0, issues: 0 },
        updated: { milestones: 0, issues: 0 },
        totalChanges: 0,
      },
    }),
    sync: async (_options: AdapterSyncOptions) => ({
      ok: true as const,
      value: {
        pushed: { milestones: 0, issues: 0 },
        pulled: { milestones: 0, issues: 0 },
        conflicts: [],
        resolved: 0,
        skipped: 0,
      },
    }),
    ...overrides,
  };
}

describe('SyncAdapter', () => {
  describe('isSyncAdapter', () => {
    it('returns true for a valid adapter', () => {
      const adapter = createMockAdapter();
      expect(isSyncAdapter(adapter)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isSyncAdapter(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isSyncAdapter(undefined)).toBe(false);
    });

    it('returns false for a string', () => {
      expect(isSyncAdapter('not an adapter')).toBe(false);
    });

    it('returns false for an object missing name', () => {
      const { name: _, ...rest } = createMockAdapter();
      expect(isSyncAdapter(rest)).toBe(false);
    });

    it('returns false for an object missing detect', () => {
      const { detect: _, ...rest } = createMockAdapter();
      expect(isSyncAdapter(rest)).toBe(false);
    });

    it('returns false for an object missing import', () => {
      const adapter = createMockAdapter();
      const broken = { ...adapter, import: 'not a function' };
      expect(isSyncAdapter(broken)).toBe(false);
    });

    it('returns false for an object missing export', () => {
      const adapter = createMockAdapter();
      const broken = { ...adapter, export: 42 };
      expect(isSyncAdapter(broken)).toBe(false);
    });

    it('returns false for an object missing sync', () => {
      const adapter = createMockAdapter();
      const broken = { ...adapter, sync: null };
      expect(isSyncAdapter(broken)).toBe(false);
    });

    it('returns false for an object missing displayName', () => {
      const { displayName: _, ...rest } = createMockAdapter();
      expect(isSyncAdapter(rest)).toBe(false);
    });
  });

  describe('mock adapter operations', () => {
    it('import returns ImportResult', async () => {
      const adapter = createMockAdapter();
      const result = await adapter.import({ metaDir: '/tmp/test' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          milestones: 0,
          epics: 0,
          stories: 0,
          totalFiles: 0,
        });
      }
    });

    it('export returns ExportResult', async () => {
      const adapter = createMockAdapter();
      const result = await adapter.export({ metaDir: '/tmp/test' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalChanges).toBe(0);
      }
    });

    it('sync returns SyncResult', async () => {
      const adapter = createMockAdapter();
      const result = await adapter.sync({ metaDir: '/tmp/test' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.conflicts).toEqual([]);
        expect(result.value.resolved).toBe(0);
      }
    });

    it('detect returns boolean', async () => {
      const adapter = createMockAdapter({ detect: async () => true });
      expect(await adapter.detect('/tmp/test')).toBe(true);
    });
  });
});
