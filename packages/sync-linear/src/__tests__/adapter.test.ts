import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isSyncAdapter } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { linearAdapter } from '../adapter.js';
import { createDefaultConfig, saveConfig } from '../config.js';

const API_KEY = 'lin_api_test_key';
const TEAM_ID = 'team-1';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function graphqlResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyListsResponse(): Response {
  return graphqlResponse({
    team: {
      cycles: { nodes: [] },
      issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
      states: { nodes: [] },
    },
  });
}

describe('linearAdapter', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-linear-adapter-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('exposes adapter name and display name', () => {
    expect(linearAdapter.name).toBe('linear');
    expect(linearAdapter.displayName).toBe('Linear');
  });

  it('conforms to the SyncAdapter interface', () => {
    expect(isSyncAdapter(linearAdapter)).toBe(true);
  });

  describe('detect', () => {
    it('returns false when no config exists', async () => {
      const ok = await linearAdapter.detect(metaDir);
      expect(ok).toBe(false);
    });

    it('returns true when a config is present', async () => {
      const config = createDefaultConfig(TEAM_ID);
      await saveConfig(metaDir, config);
      const ok = await linearAdapter.detect(metaDir);
      expect(ok).toBe(true);
    });
  });

  describe('import', () => {
    it('rejects when api key is missing', async () => {
      const result = await linearAdapter.import({
        metaDir,
        teamId: TEAM_ID,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('API key');
    });

    it('rejects when team id is missing', async () => {
      const result = await linearAdapter.import({
        metaDir,
        apiKey: API_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('team ID');
    });

    it('reads credentials from the credentials bag', async () => {
      mockFetch.mockImplementation(async () => emptyListsResponse());

      const result = await linearAdapter.import({
        metaDir,
        credentials: {
          apiKey: API_KEY,
          teamId: TEAM_ID,
        },
      });
      expect(result.ok).toBe(true);
    });

    it('falls back to options.token when apiKey is missing', async () => {
      mockFetch.mockImplementation(async () => emptyListsResponse());

      const result = await linearAdapter.import({
        metaDir,
        token: API_KEY,
        teamId: TEAM_ID,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('export', () => {
    it('rejects when api key is missing', async () => {
      const result = await linearAdapter.export({
        metaDir,
        teamId: TEAM_ID,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('API key');
    });

    it('rejects when team id cannot be resolved from options or config', async () => {
      const result = await linearAdapter.export({
        metaDir,
        apiKey: API_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('team ID');
    });

    it('reads team id from saved config when not in options', async () => {
      const config = createDefaultConfig(TEAM_ID);
      await saveConfig(metaDir, config);
      mockFetch.mockResolvedValue(emptyListsResponse());

      const result = await linearAdapter.export({
        metaDir,
        apiKey: API_KEY,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalChanges).toBe(0);
      }
    });

    it('passes credentials from the credentials bag', async () => {
      const config = createDefaultConfig(TEAM_ID);
      await saveConfig(metaDir, config);
      mockFetch.mockResolvedValue(emptyListsResponse());

      const result = await linearAdapter.export({
        metaDir,
        credentials: {
          apiKey: API_KEY,
          teamId: TEAM_ID,
        },
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('sync', () => {
    it('rejects when api key is missing', async () => {
      const result = await linearAdapter.sync({
        metaDir,
        teamId: TEAM_ID,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('API key');
    });

    it('rejects when team id cannot be resolved', async () => {
      const result = await linearAdapter.sync({
        metaDir,
        apiKey: API_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('team ID');
    });

    it('delegates to syncWithLinear when credentials resolve', async () => {
      const config = createDefaultConfig(TEAM_ID);
      await saveConfig(metaDir, config);

      const result = await linearAdapter.sync({
        metaDir,
        credentials: {
          apiKey: API_KEY,
          teamId: TEAM_ID,
        },
        strategy: 'local-wins',
      });
      // Missing sync state → sync returns an error; we still exercised the
      // credential-resolution path in the adapter.
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('No Linear sync state found');
      }
    });

    it('falls back to options.token for sync when apiKey is missing', async () => {
      const config = createDefaultConfig(TEAM_ID);
      await saveConfig(metaDir, config);

      const result = await linearAdapter.sync({
        metaDir,
        token: API_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('No Linear sync state found');
      }
    });
  });
});
