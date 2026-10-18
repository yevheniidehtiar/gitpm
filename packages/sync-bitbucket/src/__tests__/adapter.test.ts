import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bitbucketAdapter } from '../adapter.js';

vi.mock('../import.js', () => ({
  importFromBitbucket: vi.fn(async () => ({
    ok: true,
    value: {
      milestones: 0,
      epics: 0,
      stories: 0,
      totalFiles: 0,
      writtenPaths: [],
    },
  })),
}));

vi.mock('../export.js', () => ({
  exportToBitbucket: vi.fn(async () => ({
    ok: true,
    value: {
      created: { milestones: 0, issues: 0 },
      updated: { milestones: 0, issues: 0 },
      totalChanges: 0,
      exportedPaths: [],
    },
  })),
}));

vi.mock('../sync.js', () => ({
  syncWithBitbucket: vi.fn(async () => ({
    ok: true,
    value: {
      pushed: { milestones: 0, issues: 0 },
      pulled: { milestones: 0, issues: 0 },
      conflicts: [],
      resolved: 0,
      skipped: 0,
      pulledPaths: [],
      pushedPaths: [],
    },
  })),
}));

import { exportToBitbucket } from '../export.js';
import { importFromBitbucket } from '../import.js';
import { syncWithBitbucket } from '../sync.js';

let metaDir: string;

beforeEach(async () => {
  metaDir = await mkdtemp(join(tmpdir(), 'gitpm-bb-adapter-'));
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(metaDir, { recursive: true, force: true });
});

async function writeConfig(): Promise<void> {
  await mkdir(join(metaDir, 'sync'), { recursive: true });
  await writeFile(
    join(metaDir, 'sync', 'bitbucket-config.yaml'),
    'workspace: acme\nrepo_slug: web\nepic_linkage: component\n',
  );
}

describe('bitbucketAdapter', () => {
  it('has name and displayName', () => {
    expect(bitbucketAdapter.name).toBe('bitbucket');
    expect(bitbucketAdapter.displayName).toBe('Bitbucket');
  });

  describe('detect', () => {
    it('is true when the config loads', async () => {
      await writeConfig();
      expect(await bitbucketAdapter.detect(metaDir)).toBe(true);
    });

    it('is false without a config', async () => {
      expect(await bitbucketAdapter.detect(metaDir)).toBe(false);
    });
  });

  describe('import', () => {
    it('requires a token', async () => {
      const result = await bitbucketAdapter.import({
        metaDir,
        repo: 'acme/web',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('token is required');
      expect(importFromBitbucket).not.toHaveBeenCalled();
    });

    it('requires a repository without a config', async () => {
      const result = await bitbucketAdapter.import({ metaDir, token: 't' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('workspace/repo_slug');
    });

    it('parses repo and uses bearer auth for a bare token', async () => {
      const result = await bitbucketAdapter.import({
        metaDir,
        token: 't',
        repo: 'acme/web',
        linkStrategy: 'body-marker',
      });
      expect(result.ok).toBe(true);
      expect(importFromBitbucket).toHaveBeenCalledWith({
        auth: { kind: 'bearer', token: 't' },
        workspace: 'acme',
        repoSlug: 'web',
        baseUrl: undefined,
        metaDir,
        config: undefined,
        epicLinkage: 'body-marker',
      });
    });

    it('uses basic auth with an email and ignores unknown link strategies', async () => {
      await bitbucketAdapter.import({
        metaDir,
        credentials: {
          token: 't',
          email: 'a@b.c',
          workspace: 'acme',
          repo_slug: 'web',
        },
        linkStrategy: 'labels',
      });
      expect(importFromBitbucket).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: { kind: 'basic', email: 'a@b.c', token: 't' },
          workspace: 'acme',
          repoSlug: 'web',
          epicLinkage: undefined,
        }),
      );
    });

    it('falls back to the config for the repository', async () => {
      await writeConfig();
      await bitbucketAdapter.import({ metaDir, token: 't' });
      expect(importFromBitbucket).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace: 'acme',
          repoSlug: 'web',
          baseUrl: 'https://api.bitbucket.org/2.0',
          config: expect.objectContaining({ epic_linkage: 'component' }),
        }),
      );
    });
  });

  describe('export', () => {
    it('requires a token', async () => {
      await writeConfig();
      const result = await bitbucketAdapter.export({ metaDir });
      expect(result.ok).toBe(false);
      expect(exportToBitbucket).not.toHaveBeenCalled();
    });

    it('requires a config', async () => {
      const result = await bitbucketAdapter.export({
        metaDir,
        token: 't',
        repo: 'acme/web',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('Bitbucket config');
      expect(exportToBitbucket).not.toHaveBeenCalled();
    });

    it('delegates with config values', async () => {
      await writeConfig();
      const result = await bitbucketAdapter.export({
        metaDir,
        token: 't',
        dryRun: true,
        baseUrl: 'https://bb.example.com/2.0',
      });
      expect(result.ok).toBe(true);
      expect(exportToBitbucket).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace: 'acme',
          repoSlug: 'web',
          baseUrl: 'https://bb.example.com/2.0',
          dryRun: true,
          config: expect.objectContaining({ workspace: 'acme' }),
        }),
      );
    });
  });

  describe('sync', () => {
    it('requires a token', async () => {
      await writeConfig();
      const result = await bitbucketAdapter.sync({ metaDir });
      expect(result.ok).toBe(false);
      expect(syncWithBitbucket).not.toHaveBeenCalled();
    });

    it('requires a config', async () => {
      const result = await bitbucketAdapter.sync({
        metaDir,
        token: 't',
        workspace: 'acme',
        repoSlug: 'web',
      });
      expect(result.ok).toBe(false);
      expect(syncWithBitbucket).not.toHaveBeenCalled();
    });

    it('delegates with strategy and dryRun', async () => {
      await writeConfig();
      const result = await bitbucketAdapter.sync({
        metaDir,
        token: 't',
        strategy: 'local-wins',
        dryRun: false,
      });
      expect(result.ok).toBe(true);
      expect(syncWithBitbucket).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace: 'acme',
          repoSlug: 'web',
          strategy: 'local-wins',
          dryRun: false,
        }),
      );
    });
  });
});
