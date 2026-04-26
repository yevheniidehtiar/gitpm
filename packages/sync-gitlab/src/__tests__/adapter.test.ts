import { writeFile as fsWriteFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gitlabAdapter } from '../adapter.js';

vi.mock('../import.js', () => ({
  importFromGitLab: vi.fn(async () => ({
    ok: true,
    value: { milestones: 0, epics: 0, stories: 0, totalFiles: 0 },
  })),
}));

vi.mock('../export.js', () => ({
  exportToGitLab: vi.fn(async () => ({
    ok: true,
    value: {
      created: { milestones: 0, issues: 0 },
      updated: { milestones: 0, issues: 0 },
      totalChanges: 0,
    },
  })),
}));

vi.mock('../sync.js', () => ({
  syncWithGitLab: vi.fn(async () => ({
    ok: true,
    value: {
      pushed: { milestones: 0, issues: 0 },
      pulled: { milestones: 0, issues: 0 },
      conflicts: [],
      resolved: 0,
      skipped: 0,
    },
  })),
}));

import { exportToGitLab } from '../export.js';
import { importFromGitLab } from '../import.js';
import { syncWithGitLab } from '../sync.js';

let metaDir: string;

beforeEach(async () => {
  metaDir = await mkdtemp(join(tmpdir(), 'gitpm-adapter-'));
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(metaDir, { recursive: true });
});

async function writeConfig(): Promise<void> {
  await mkdir(join(metaDir, 'sync'), { recursive: true });
  await fsWriteFile(
    join(metaDir, 'sync', 'gitlab-config.yaml'),
    [
      'project: ns/proj',
      'project_id: 42',
      'base_url: https://gitlab.com',
      'group_id: 10',
      'auto_sync: false',
      'status_mapping: {}',
      'label_mapping:',
      '  epic_labels: [epic]',
      '',
    ].join('\n'),
    'utf-8',
  );
}

describe('gitlabAdapter', () => {
  it('has name and displayName', () => {
    expect(gitlabAdapter.name).toBe('gitlab');
    expect(gitlabAdapter.displayName).toBe('GitLab');
  });

  describe('detect', () => {
    it('returns false when config file missing', async () => {
      expect(await gitlabAdapter.detect(metaDir)).toBe(false);
    });

    it('returns true when config file present', async () => {
      await writeConfig();
      expect(await gitlabAdapter.detect(metaDir)).toBe(true);
    });
  });

  describe('import', () => {
    it('returns error when token is missing', async () => {
      const result = await gitlabAdapter.import({
        project: 'ns/proj',
        metaDir,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/token is required/);
    });

    it('returns error when project is missing', async () => {
      const result = await gitlabAdapter.import({
        token: 't',
        metaDir,
      });
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error.message).toMatch(/project is required/);
    });

    it('delegates to importFromGitLab using top-level token & project', async () => {
      const result = await gitlabAdapter.import({
        token: 'tok',
        project: 'ns/proj',
        metaDir,
      });
      expect(result.ok).toBe(true);
      expect(importFromGitLab).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'tok',
          project: 'ns/proj',
          metaDir,
        }),
      );
    });

    it('uses credentials fallback', async () => {
      const result = await gitlabAdapter.import({
        credentials: { token: 'cred-tok', project: 'cred/proj' },
        metaDir,
        projectId: 42,
        groupId: 10,
        baseUrl: 'https://gl.example.com',
        linkStrategy: 'body-refs',
      });
      expect(result.ok).toBe(true);
      expect(importFromGitLab).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'cred-tok',
          project: 'cred/proj',
          projectId: 42,
          groupId: 10,
          baseUrl: 'https://gl.example.com',
          linkStrategy: 'body-refs',
        }),
      );
    });
  });

  describe('export', () => {
    it('returns error when token is missing', async () => {
      const result = await gitlabAdapter.export({
        project: 'ns/proj',
        metaDir,
      });
      expect(result.ok).toBe(false);
    });

    it('returns error when project is missing and no config', async () => {
      const result = await gitlabAdapter.export({
        token: 'tok',
        metaDir,
      });
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error.message).toMatch(/project is required/);
    });

    it('uses config project when no explicit project', async () => {
      await writeConfig();
      const result = await gitlabAdapter.export({
        token: 'tok',
        metaDir,
        dryRun: true,
      });
      expect(result.ok).toBe(true);
      expect(exportToGitLab).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'tok',
          project: 'ns/proj',
          projectId: 42,
          groupId: 10,
          baseUrl: 'https://gitlab.com',
          metaDir,
          dryRun: true,
        }),
      );
    });

    it('uses explicit project over config', async () => {
      await writeConfig();
      const result = await gitlabAdapter.export({
        token: 'tok',
        project: 'other/proj',
        metaDir,
      });
      expect(result.ok).toBe(true);
      expect(exportToGitLab).toHaveBeenCalledWith(
        expect.objectContaining({ project: 'other/proj' }),
      );
    });
  });

  describe('sync', () => {
    it('returns error when token is missing', async () => {
      const result = await gitlabAdapter.sync({
        project: 'ns/proj',
        metaDir,
      });
      expect(result.ok).toBe(false);
    });

    it('returns error when project is missing and no config', async () => {
      const result = await gitlabAdapter.sync({
        token: 'tok',
        metaDir,
      });
      expect(result.ok).toBe(false);
    });

    it('delegates to syncWithGitLab with config values', async () => {
      await writeConfig();
      const result = await gitlabAdapter.sync({
        token: 'tok',
        metaDir,
        strategy: 'local-wins',
        dryRun: false,
      });
      expect(result.ok).toBe(true);
      expect(syncWithGitLab).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'tok',
          project: 'ns/proj',
          projectId: 42,
          groupId: 10,
          baseUrl: 'https://gitlab.com',
          strategy: 'local-wins',
        }),
      );
    });

    it('uses credentials fallback for project', async () => {
      const result = await gitlabAdapter.sync({
        token: 'tok',
        credentials: { project: 'cred/proj' },
        metaDir,
      });
      expect(result.ok).toBe(true);
      expect(syncWithGitLab).toHaveBeenCalledWith(
        expect.objectContaining({ project: 'cred/proj' }),
      );
    });
  });
});
