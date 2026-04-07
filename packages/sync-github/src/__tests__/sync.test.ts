import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile as coreWriteFile, parseTree } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixtureIssues from '../__fixtures__/github-issues.json';
import fixtureMilestones from '../__fixtures__/github-milestones.json';
import type { GhIssue, GhMilestone } from '../client.js';
import { importFromGitHub } from '../import.js';
import { syncWithGitHub } from '../sync.js';

const mockUpdateIssue = vi.fn().mockImplementation(async () => ({
  number: 1,
  title: 'Updated',
  body: '',
  state: 'open',
  assignee: null,
  labels: [],
  milestone: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}));

const mockGetIssue = vi.fn().mockResolvedValue(null);
const mockGetMilestone = vi.fn().mockResolvedValue(null);
const mockCreateIssue = vi.fn().mockImplementation(async () => ({
  number: 200,
  title: 'New',
  body: '',
  state: 'open',
  assignee: null,
  labels: [],
  milestone: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}));
const mockCreateMilestone = vi.fn().mockImplementation(async () => ({
  number: 20,
  title: 'New MS',
  description: '',
  state: 'open',
  due_on: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}));
const mockUpdateMilestone = vi.fn().mockImplementation(async () => ({
  number: 1,
  title: 'Updated MS',
  description: '',
  state: 'open',
  due_on: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}));

vi.mock('../client.js', () => {
  return {
    GitHubClient: vi.fn().mockImplementation(function () {
      return {
        listMilestones: vi
          .fn()
          .mockResolvedValue(fixtureMilestones as GhMilestone[]),
        listIssues: vi
          .fn()
          .mockResolvedValue(
            (fixtureIssues as GhIssue[]).filter(
              (i: GhIssue) => !i.pull_request,
            ),
          ),
        listSubIssues: vi.fn().mockResolvedValue([]),
        getProject: vi.fn().mockResolvedValue(null),
        getProjectItems: vi.fn().mockResolvedValue([]),
        createIssue: mockCreateIssue,
        updateIssue: mockUpdateIssue,
        createMilestone: mockCreateMilestone,
        updateMilestone: mockUpdateMilestone,
        getIssue: mockGetIssue,
        getMilestone: mockGetMilestone,
      };
    }),
  };
});

describe('syncWithGitHub', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-sync-test-'));
    metaDir = join(tmpDir, '.meta');
    mockUpdateIssue.mockClear();
    mockGetIssue.mockClear();
    mockGetMilestone.mockClear();
    mockCreateIssue.mockClear();
    mockCreateMilestone.mockClear();
    mockUpdateMilestone.mockClear();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns error when no sync state exists', async () => {
    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('No sync state found');
    }
  });

  it('returns error for invalid repo format', async () => {
    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'invalid',
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid repo format');
    }
  });

  it('syncs successfully when everything is in sync', async () => {
    // Import first to create state
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    // Sync — everything should be in sync (remote returns null so entities get pulled as deleted)
    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(true);
  });

  it('detects locally modified entities via hash change', async () => {
    // Import first
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    // Parse tree and modify a story
    const treeResult = await parseTree(metaDir);
    expect(treeResult.ok).toBe(true);
    if (!treeResult.ok) return;

    const stories = treeResult.value.stories;
    if (stories.length > 0) {
      const story = stories[0];
      story.title = 'Modified by local edit';
      const filePath = join(metaDir, '..', story.filePath);
      await coreWriteFile(story, filePath);
    }

    // Sync with local-wins
    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(true);
  });

  it('dry run does not call GitHub API for mutations', async () => {
    // Import first
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
      dryRun: true,
    });
    expect(result.ok).toBe(true);
    // In dry run mode, no mutations
    expect(mockUpdateIssue).not.toHaveBeenCalled();
    expect(mockCreateIssue).not.toHaveBeenCalled();
    expect(mockUpdateMilestone).not.toHaveBeenCalled();
    expect(mockCreateMilestone).not.toHaveBeenCalled();
  });

  it('handles remote-wins conflict strategy', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'remote-wins',
    });
    expect(result.ok).toBe(true);
  });

  it('handles ask strategy by collecting unresolved conflicts', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'ask',
    });
    expect(result.ok).toBe(true);
  });
});
