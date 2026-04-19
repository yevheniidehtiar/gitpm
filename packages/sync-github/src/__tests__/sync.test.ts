import { createHash } from 'node:crypto';
import { mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile as coreWriteFile, parseTree } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixtureIssues from '../__fixtures__/github-issues.json';
import fixtureMilestones from '../__fixtures__/github-milestones.json';
import { hasCheckpoint, saveCheckpoint } from '../checkpoint.js';
import type { GhIssue, GhMilestone } from '../client.js';
import { remoteIssueFields, remoteMilestoneFields } from '../diff.js';
import { importFromGitHub } from '../import.js';
import { loadState, saveState } from '../state.js';
import { syncWithGitHub } from '../sync.js';
import type { SyncCheckpoint } from '../types.js';

function hashOf(fields: Record<string, unknown>): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(fields)).digest('hex')}`;
}
const remoteHashOfIssue = (gh: GhIssue) => hashOf(remoteIssueFields(gh));
const remoteHashOfMs = (gh: GhMilestone) => hashOf(remoteMilestoneFields(gh));

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

  it('records failedEntities and saves checkpoint when an API call throws', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    // Make getIssue throw for all calls to trigger per-entity catch
    mockGetIssue.mockRejectedValue(new Error('API rate limit exceeded'));
    mockGetMilestone.mockRejectedValue(new Error('API rate limit exceeded'));

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failedEntities.length).toBeGreaterThan(0);
      expect(result.value.failedEntities[0].error).toContain(
        'API rate limit exceeded',
      );
    }

    // Checkpoint should have been saved
    const cpExists = await hasCheckpoint(metaDir);
    expect(cpExists.ok).toBe(true);
    if (cpExists.ok) {
      expect(cpExists.value).toBe(true);
    }
  });

  it('resumes from checkpoint and skips already-processed entities', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    // Parse tree to get entity IDs
    const treeResult = await parseTree(metaDir);
    expect(treeResult.ok).toBe(true);
    if (!treeResult.ok) return;

    const allIds = [
      ...treeResult.value.milestones.map((m) => m.id),
      ...treeResult.value.epics.map((e) => e.id),
      ...treeResult.value.stories.map((s) => s.id),
    ];

    // Create a checkpoint that marks some entities as already processed
    const cp: SyncCheckpoint = {
      startedAt: '2026-04-07T10:00:00Z',
      repo: 'test-org/test-repo',
      processedEntityIds: allIds.slice(0, 2),
      lastError: {
        entityId: allIds[2] ?? 'unknown',
        message: 'Previous failure',
      },
    };
    await saveCheckpoint(metaDir, cp);

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.resumedFromCheckpoint).toBe(true);
    }
  });

  it('returns error when checkpoint check fails', async () => {
    // Prime sync state so loadState succeeds
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });
    // Sync against a broken checkpoint path (NUL byte in metaDir)
    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir: `${metaDir}\u0000/bad`,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(false);
  });

  it('pushes local_changed milestone and issue to remote (local-wins path)', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const tree = await parseTree(metaDir);
    if (!tree.ok) throw new Error('parseTree failed');
    const milestone = tree.value.milestones[0];
    const story = tree.value.stories[0];

    const state = await loadState(metaDir);
    if (!state.ok) throw new Error('loadState failed');

    // Build fake remote resources whose hashes will match state.remote_hash
    const fakeIssue: GhIssue = {
      number: state.value.entities[story.id].github_issue_number ?? 1,
      title: 'Remote Title',
      body: 'Remote body',
      state: 'open',
      assignee: null,
      labels: [],
      milestone: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const fakeMilestone: GhMilestone = {
      number: state.value.entities[milestone.id].github_milestone_number ?? 1,
      title: 'Remote MS',
      description: 'remote ms body',
      state: 'open',
      due_on: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    mockGetIssue.mockImplementation(async (_o, _r, n) =>
      n === fakeIssue.number ? fakeIssue : null,
    );
    mockGetMilestone.mockImplementation(async (_o, _r, n) =>
      n === fakeMilestone.number ? fakeMilestone : null,
    );

    // Force state so current remote hash matches stored remote_hash (no remote
    // change) but stored local_hash is stale → triggers local_changed.
    state.value.entities[story.id] = {
      ...state.value.entities[story.id],
      local_hash: 'sha256:stale',
      remote_hash: remoteHashOfIssue(fakeIssue),
    };
    state.value.entities[milestone.id] = {
      ...state.value.entities[milestone.id],
      local_hash: 'sha256:stale',
      remote_hash: remoteHashOfMs(fakeMilestone),
    };
    await saveState(metaDir, state.value);

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(true);
    expect(mockUpdateIssue).toHaveBeenCalled();
    expect(mockUpdateMilestone).toHaveBeenCalled();
  });

  it('pulls remote_changed entities into local when remote changed', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const tree = await parseTree(metaDir);
    if (!tree.ok) throw new Error('parseTree failed');
    const milestone = tree.value.milestones[0];
    const story = tree.value.stories[0];

    const state = await loadState(metaDir);
    if (!state.ok) throw new Error('loadState failed');

    const fakeIssue: GhIssue = {
      number: state.value.entities[story.id].github_issue_number ?? 1,
      title: 'Remote-Renamed Title',
      body: 'Remote body change',
      state: 'closed',
      assignee: { login: 'remote-user' },
      labels: [{ name: 'remote-label' }],
      milestone: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const fakeMilestone: GhMilestone = {
      number: state.value.entities[milestone.id].github_milestone_number ?? 1,
      title: 'Remote Milestone Renamed',
      description: 'remote desc',
      state: 'closed',
      due_on: '2026-09-30T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    mockGetIssue.mockImplementation(async (_o, _r, n) =>
      n === fakeIssue.number ? fakeIssue : null,
    );
    mockGetMilestone.mockImplementation(async (_o, _r, n) =>
      n === fakeMilestone.number ? fakeMilestone : null,
    );

    // Local not modified → currentLocalHash matches state.local_hash.
    // Make state.remote_hash stale → remote_changed.
    state.value.entities[story.id] = {
      ...state.value.entities[story.id],
      remote_hash: 'sha256:stale-remote',
    };
    state.value.entities[milestone.id] = {
      ...state.value.entities[milestone.id],
      remote_hash: 'sha256:stale-remote',
    };
    await saveState(metaDir, state.value);

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'remote-wins',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pulled.issues).toBeGreaterThan(0);
      expect(result.value.pulled.milestones).toBeGreaterThan(0);
    }
  });

  it('pulls remote_changed data into an epic (covers applyRemoteIssue owner branch)', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const tree = await parseTree(metaDir);
    if (!tree.ok) throw new Error('parseTree failed');
    const epic = tree.value.epics[0];

    const state = await loadState(metaDir);
    if (!state.ok) throw new Error('loadState failed');

    const fakeIssue: GhIssue = {
      number: state.value.entities[epic.id].github_issue_number ?? 1,
      title: 'Renamed Epic',
      body: 'Epic body update',
      state: 'closed',
      assignee: { login: 'new-owner' },
      labels: [{ name: 'epic' }],
      milestone: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    mockGetIssue.mockImplementation(async (_o, _r, n) =>
      n === fakeIssue.number ? fakeIssue : null,
    );

    state.value.entities[epic.id] = {
      ...state.value.entities[epic.id],
      remote_hash: 'sha256:stale-remote',
    };
    await saveState(metaDir, state.value);

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'remote-wins',
    });
    expect(result.ok).toBe(true);
  });

  it('both_changed → local-wins resolves to local update', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const tree = await parseTree(metaDir);
    if (!tree.ok) throw new Error('parseTree failed');
    const milestone = tree.value.milestones[0];
    const story = tree.value.stories[0];

    const state = await loadState(metaDir);
    if (!state.ok) throw new Error('loadState failed');

    const fakeIssue: GhIssue = {
      number: state.value.entities[story.id].github_issue_number ?? 1,
      title: 'Remote Conflict',
      body: 'Remote body',
      state: 'open',
      assignee: null,
      labels: [],
      milestone: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const fakeMilestone: GhMilestone = {
      number: state.value.entities[milestone.id].github_milestone_number ?? 1,
      title: 'Remote MS Conflict',
      description: 'ms body',
      state: 'open',
      due_on: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    mockGetIssue.mockImplementation(async (_o, _r, n) =>
      n === fakeIssue.number ? fakeIssue : null,
    );
    mockGetMilestone.mockImplementation(async (_o, _r, n) =>
      n === fakeMilestone.number ? fakeMilestone : null,
    );

    // Both hashes stale → both_changed.
    state.value.entities[story.id] = {
      ...state.value.entities[story.id],
      local_hash: 'sha256:stale-local',
      remote_hash: 'sha256:stale-remote',
    };
    state.value.entities[milestone.id] = {
      ...state.value.entities[milestone.id],
      local_hash: 'sha256:stale-local',
      remote_hash: 'sha256:stale-remote',
    };
    await saveState(metaDir, state.value);

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.resolved).toBeGreaterThan(0);
    }
    expect(mockUpdateIssue).toHaveBeenCalled();
    expect(mockUpdateMilestone).toHaveBeenCalled();
  });

  it('both_changed → remote-wins pulls remote into local', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const tree = await parseTree(metaDir);
    if (!tree.ok) throw new Error('parseTree failed');
    const milestone = tree.value.milestones[0];
    const story = tree.value.stories[0];

    const state = await loadState(metaDir);
    if (!state.ok) throw new Error('loadState failed');

    const fakeIssue: GhIssue = {
      number: state.value.entities[story.id].github_issue_number ?? 1,
      title: 'Remote Conflict',
      body: 'Remote body',
      state: 'open',
      assignee: null,
      labels: [],
      milestone: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const fakeMilestone: GhMilestone = {
      number: state.value.entities[milestone.id].github_milestone_number ?? 1,
      title: 'Remote MS Conflict',
      description: '',
      state: 'open',
      due_on: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    mockGetIssue.mockImplementation(async (_o, _r, n) =>
      n === fakeIssue.number ? fakeIssue : null,
    );
    mockGetMilestone.mockImplementation(async (_o, _r, n) =>
      n === fakeMilestone.number ? fakeMilestone : null,
    );

    state.value.entities[story.id] = {
      ...state.value.entities[story.id],
      local_hash: 'sha256:stale-local',
      remote_hash: 'sha256:stale-remote',
    };
    state.value.entities[milestone.id] = {
      ...state.value.entities[milestone.id],
      local_hash: 'sha256:stale-local',
      remote_hash: 'sha256:stale-remote',
    };
    await saveState(metaDir, state.value);

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'remote-wins',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.resolved).toBeGreaterThan(0);
    }
  });

  it('both_changed → ask strategy records unresolved conflicts', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const tree = await parseTree(metaDir);
    if (!tree.ok) throw new Error('parseTree failed');
    const story = tree.value.stories[0];

    const state = await loadState(metaDir);
    if (!state.ok) throw new Error('loadState failed');

    const fakeIssue: GhIssue = {
      number: state.value.entities[story.id].github_issue_number ?? 1,
      title: 'Remote Ask',
      body: 'Body',
      state: 'open',
      assignee: null,
      labels: [],
      milestone: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    mockGetIssue.mockImplementation(async (_o, _r, n) =>
      n === fakeIssue.number ? fakeIssue : null,
    );

    state.value.entities[story.id] = {
      ...state.value.entities[story.id],
      local_hash: 'sha256:stale-local',
      remote_hash: 'sha256:stale-remote',
    };
    await saveState(metaDir, state.value);

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'ask',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.conflicts.length).toBeGreaterThan(0);
      expect(result.value.skipped).toBeGreaterThan(0);
    }
  });

  it('closes GitHub resources for entities deleted locally', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const tree = await parseTree(metaDir);
    if (!tree.ok) throw new Error('parseTree failed');
    const story = tree.value.stories[0];
    const milestone = tree.value.milestones[0];

    // Delete the story + milestone files from disk but keep state entries →
    // sync should treat them as locally-deleted (updateIssue state=closed).
    await unlink(story.filePath);
    await unlink(milestone.filePath);

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(true);
    expect(mockUpdateIssue).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ state: 'closed' }),
    );
    expect(mockUpdateMilestone).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ state: 'closed' }),
    );
  });

  it('creates GitHub resources for new local entities (not in sync state)', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    // Add an untracked story + untracked milestone to the .meta tree:
    // remove their entries from sync state so they are treated as "new".
    const tree = await parseTree(metaDir);
    if (!tree.ok) throw new Error('parseTree failed');
    const story = tree.value.stories.find((s) => s.status !== 'done');
    const milestone = tree.value.milestones[0];
    if (!story || !milestone) throw new Error('fixture assumption broken');

    const state = await loadState(metaDir);
    if (!state.ok) throw new Error('loadState failed');
    delete state.value.entities[story.id];
    delete state.value.entities[milestone.id];
    await saveState(metaDir, state.value);

    // Also force status=done on the story to exercise the close-after-create branch.
    story.status = 'done';
    await coreWriteFile(story, story.filePath);

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(true);
    expect(mockCreateIssue).toHaveBeenCalled();
    expect(mockCreateMilestone).toHaveBeenCalled();
    // Since story.status === 'done', updateIssue with state:closed should be called
    expect(mockUpdateIssue).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ state: 'closed' }),
    );
  });

  it('records failedEntities when a new-entity create fails', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    const tree = await parseTree(metaDir);
    if (!tree.ok) throw new Error('parseTree failed');
    const story = tree.value.stories[0];

    const state = await loadState(metaDir);
    if (!state.ok) throw new Error('loadState failed');
    delete state.value.entities[story.id];
    await saveState(metaDir, state.value);

    mockCreateIssue.mockRejectedValueOnce(new Error('quota exceeded'));

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failedEntities.length).toBeGreaterThan(0);
      expect(result.value.failedEntities[0].error).toContain('quota exceeded');
    }
  });

  it('does not write checkpoint during dry run even on failure', async () => {
    await importFromGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
    });

    mockGetIssue.mockRejectedValue(new Error('API error'));
    mockGetMilestone.mockRejectedValue(new Error('API error'));

    const result = await syncWithGitHub({
      token: 'test-token',
      repo: 'test-org/test-repo',
      metaDir,
      strategy: 'local-wins',
      dryRun: true,
    });

    expect(result.ok).toBe(true);

    // No checkpoint should be written during dry run
    const cpExists = await hasCheckpoint(metaDir);
    expect(cpExists.ok).toBe(true);
    if (cpExists.ok) {
      expect(cpExists.value).toBe(false);
    }
  });
});
