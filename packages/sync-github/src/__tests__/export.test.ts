import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixtureIssues from '../__fixtures__/github-issues.json';
import fixtureMilestones from '../__fixtures__/github-milestones.json';
import type { GhIssue, GhMilestone } from '../client.js';
import { exportToGitHub } from '../export.js';
import { importFromGitHub } from '../import.js';
import { loadState } from '../state.js';

// Track mock calls
const mockCreateIssue = vi.fn().mockImplementation(async () => ({
  number: 100 + Math.floor(Math.random() * 900),
  title: 'Created Issue',
  body: '',
  state: 'open',
  assignee: null,
  labels: [],
  milestone: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}));

const mockUpdateIssue = vi.fn().mockImplementation(async () => ({
  number: 1,
  title: 'Updated Issue',
  body: '',
  state: 'open',
  assignee: null,
  labels: [],
  milestone: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}));

const mockCreateMilestone = vi.fn().mockImplementation(async () => ({
  number: 10 + Math.floor(Math.random() * 90),
  title: 'Created Milestone',
  description: '',
  state: 'open',
  due_on: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}));

const mockUpdateMilestone = vi.fn().mockImplementation(async () => ({
  number: 1,
  title: 'Updated Milestone',
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
        getIssue: vi.fn().mockResolvedValue(null),
        getMilestone: vi.fn().mockResolvedValue(null),
      };
    }),
  };
});

describe('exportToGitHub', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-export-test-'));
    metaDir = join(tmpDir, '.meta');
    mockCreateIssue.mockClear();
    mockUpdateIssue.mockClear();
    mockCreateMilestone.mockClear();
    mockUpdateMilestone.mockClear();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns error for invalid repo format', async () => {
    const result = await exportToGitHub({
      token: 'test-token',
      repo: 'invalid',
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid repo format');
    }
  });

  it('exports after import without creating new entities', async () => {
    // First import to create the .meta tree
    const importResult = await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });
    expect(importResult.ok).toBe(true);

    // Now export — all entities already have GitHub IDs, no new ones should be created
    const exportResult = await exportToGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });
    expect(exportResult.ok).toBe(true);
    if (exportResult.ok) {
      // Nothing should have been created since all entities already have sync metadata
      expect(exportResult.value.created.milestones).toBe(0);
      expect(exportResult.value.created.issues).toBe(0);
      // Some may show as updated due to hash recomputation after write round-trip
    }
  });

  it('dry run does not modify state', async () => {
    // Import first
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const stateBefore = await loadState(metaDir);
    expect(stateBefore.ok).toBe(true);

    const exportResult = await exportToGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      dryRun: true,
    });
    expect(exportResult.ok).toBe(true);

    const stateAfter = await loadState(metaDir);
    expect(stateAfter.ok).toBe(true);
    if (stateBefore.ok && stateAfter.ok) {
      expect(stateAfter.value.last_sync).toBe(stateBefore.value.last_sync);
    }
  });

  it('updates sync state after export', async () => {
    // Import first
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const result = await exportToGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });
    expect(result.ok).toBe(true);

    const stateResult = await loadState(metaDir);
    expect(stateResult.ok).toBe(true);
    if (stateResult.ok) {
      expect(stateResult.value.repo).toBe('test-org/test-repo');
      expect(Object.keys(stateResult.value.entities).length).toBeGreaterThan(0);
    }
  });
});
