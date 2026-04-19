import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockImport = vi.fn();
const mockExport = vi.fn();
const mockSync = vi.fn();

vi.mock('../import.js', () => ({
  importFromGitHub: (opts: unknown) => mockImport(opts),
}));
vi.mock('../export.js', () => ({
  exportToGitHub: (opts: unknown) => mockExport(opts),
}));
vi.mock('../sync.js', () => ({
  syncWithGitHub: (opts: unknown) => mockSync(opts),
}));

import { githubAdapter } from '../adapter.js';

describe('githubAdapter', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-adapter-test-'));
    metaDir = join(tmpDir, '.meta');
    mockImport.mockReset();
    mockExport.mockReset();
    mockSync.mockReset();
    mockImport.mockResolvedValue({ ok: true, value: {} });
    mockExport.mockResolvedValue({ ok: true, value: {} });
    mockSync.mockResolvedValue({ ok: true, value: {} });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('metadata', () => {
    it('exposes name and displayName', () => {
      expect(githubAdapter.name).toBe('github');
      expect(githubAdapter.displayName).toBe('GitHub');
    });
  });

  describe('detect', () => {
    it('returns false when no config exists', async () => {
      const result = await githubAdapter.detect(metaDir);
      expect(result).toBe(false);
    });

    it('returns true when github-config.yaml exists', async () => {
      await mkdir(join(metaDir, 'sync'), { recursive: true });
      await writeFile(
        join(metaDir, 'sync', 'github-config.yaml'),
        'repo: owner/repo\nauto_sync: false\n',
        'utf-8',
      );
      const result = await githubAdapter.detect(metaDir);
      expect(result).toBe(true);
    });
  });

  describe('import', () => {
    it('returns error when no token is provided', async () => {
      const result = await githubAdapter.import({ metaDir });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('GitHub token is required');
      }
    });

    it('returns error when no repo is provided', async () => {
      const result = await githubAdapter.import({
        metaDir,
        token: 'tok',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('GitHub repo is required');
      }
    });

    it('forwards to importFromGitHub when token and repo given as top-level', async () => {
      await githubAdapter.import({
        metaDir,
        token: 'tok',
        repo: 'owner/repo',
        projectNumber: 7,
        linkStrategy: 'body-refs',
      });
      expect(mockImport).toHaveBeenCalledWith({
        token: 'tok',
        repo: 'owner/repo',
        projectNumber: 7,
        metaDir,
        linkStrategy: 'body-refs',
      });
    });

    it('resolves token and repo from credentials map', async () => {
      await githubAdapter.import({
        metaDir,
        credentials: { token: 'tok2', repo: 'a/b' },
      });
      expect(mockImport).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'tok2', repo: 'a/b', metaDir }),
      );
    });
  });

  describe('export', () => {
    it('returns error when no token is provided', async () => {
      const result = await githubAdapter.export({ metaDir });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('GitHub token is required');
      }
    });

    it('returns error when no repo can be resolved', async () => {
      const result = await githubAdapter.export({
        metaDir,
        token: 'tok',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('GitHub repo is required');
      }
    });

    it('forwards to exportToGitHub with top-level repo', async () => {
      await githubAdapter.export({
        metaDir,
        token: 'tok',
        repo: 'owner/repo',
        dryRun: true,
      });
      expect(mockExport).toHaveBeenCalledWith({
        token: 'tok',
        repo: 'owner/repo',
        metaDir,
        dryRun: true,
      });
    });

    it('falls back to repo from github-config.yaml', async () => {
      await mkdir(join(metaDir, 'sync'), { recursive: true });
      await writeFile(
        join(metaDir, 'sync', 'github-config.yaml'),
        'repo: config/repo\nauto_sync: false\n',
        'utf-8',
      );
      await githubAdapter.export({ metaDir, token: 'tok' });
      expect(mockExport).toHaveBeenCalledWith(
        expect.objectContaining({ repo: 'config/repo' }),
      );
    });

    it('falls back to repo from credentials map', async () => {
      await githubAdapter.export({
        metaDir,
        credentials: { token: 'tok', repo: 'cred/repo' },
      });
      expect(mockExport).toHaveBeenCalledWith(
        expect.objectContaining({ repo: 'cred/repo' }),
      );
    });
  });

  describe('sync', () => {
    it('returns error when no token is provided', async () => {
      const result = await githubAdapter.sync({ metaDir });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('GitHub token is required');
      }
    });

    it('returns error when no repo can be resolved', async () => {
      const result = await githubAdapter.sync({
        metaDir,
        token: 'tok',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('GitHub repo is required');
      }
    });

    it('forwards to syncWithGitHub with top-level repo', async () => {
      await githubAdapter.sync({
        metaDir,
        token: 'tok',
        repo: 'owner/repo',
        strategy: 'local-wins',
        dryRun: false,
      });
      expect(mockSync).toHaveBeenCalledWith({
        token: 'tok',
        repo: 'owner/repo',
        metaDir,
        strategy: 'local-wins',
        dryRun: false,
      });
    });

    it('falls back to repo from github-config.yaml', async () => {
      await mkdir(join(metaDir, 'sync'), { recursive: true });
      await writeFile(
        join(metaDir, 'sync', 'github-config.yaml'),
        'repo: config/sync\nauto_sync: false\n',
        'utf-8',
      );
      await githubAdapter.sync({ metaDir, token: 'tok' });
      expect(mockSync).toHaveBeenCalledWith(
        expect.objectContaining({ repo: 'config/sync' }),
      );
    });
  });
});
