/**
 * End-to-end test for the full GitPM lifecycle:
 *   init → import → validate → push (dry-run) → sync (dry-run)
 *
 * Uses mocked GitHubClient — no real GitHub API calls.
 * Safe to run periodically in CI without polluting GitHub.
 */
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseTree,
  resolveRefs,
  scaffoldMeta,
  validateTree,
} from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GhIssue, GhMilestone } from '../client.js';
import { exportToGitHub } from '../export.js';
import { importFromGitHub } from '../import.js';
import { loadState } from '../state.js';
import { syncWithGitHub } from '../sync.js';

import fixtureIssues from '../__fixtures__/github-issues.json';
import fixtureMilestones from '../__fixtures__/github-milestones.json';

// --- Mock GitHub client (no real API calls) ---

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

const filteredIssues = (fixtureIssues as GhIssue[]).filter(
  (i: GhIssue) => !i.pull_request,
);

vi.mock('../client.js', () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => ({
      listMilestones: vi
        .fn()
        .mockResolvedValue(fixtureMilestones as GhMilestone[]),
      listIssues: vi.fn().mockResolvedValue(filteredIssues),
      listSubIssues: vi.fn().mockResolvedValue([]),
      getProject: vi.fn().mockResolvedValue(null),
      getProjectItems: vi.fn().mockResolvedValue([]),
      createIssue: mockCreateIssue,
      updateIssue: mockUpdateIssue,
      createMilestone: mockCreateMilestone,
      updateMilestone: mockUpdateMilestone,
      getIssue: vi.fn().mockResolvedValue(null),
      getMilestone: vi.fn().mockResolvedValue(null),
    })),
  };
});

describe('e2e: full lifecycle (mocked GitHub)', () => {
  let tmpDir: string;
  let metaDir: string;
  const repo = 'test-org/test-repo';
  const token = 'mock-token';

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-e2e-'));
    metaDir = join(tmpDir, '.meta');
    mockCreateIssue.mockClear();
    mockUpdateIssue.mockClear();
    mockCreateMilestone.mockClear();
    mockUpdateMilestone.mockClear();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('init → import → validate → push → sync full cycle', async () => {
    // --- Step 1: Init (into a separate dir to verify it works) ---
    const initDir = join(tmpDir, '.meta-init');
    const scaffoldResult = await scaffoldMeta(initDir, 'e2e-project');
    expect(scaffoldResult.ok).toBe(true);

    // Verify scaffold created valid tree
    const initTree = await parseTree(initDir);
    expect(initTree.ok).toBe(true);

    // --- Step 2: Import (into fresh metaDir) ---
    const importResult = await importFromGitHub({ token, repo, metaDir });
    expect(importResult.ok).toBe(true);
    if (!importResult.ok) return;
    expect(importResult.value.milestones).toBe(2);
    expect(importResult.value.epics).toBe(2);
    expect(importResult.value.stories).toBe(4);

    // --- Step 3: Validate ---
    const treeResult = await parseTree(metaDir);
    expect(treeResult.ok).toBe(true);
    if (!treeResult.ok) return;
    const tree = treeResult.value;

    // Resolve references
    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    // Validate tree integrity
    const validation = validateTree(resolved.value);
    expect(validation.errors).toHaveLength(0);

    // Verify entity counts
    expect(tree.milestones).toHaveLength(2);
    expect(tree.epics).toHaveLength(2);
    expect(tree.stories).toHaveLength(4);
    expect(tree.roadmaps).toHaveLength(1);

    // Verify every entity has GitHub sync metadata
    for (const ms of tree.milestones) {
      expect(ms.github).toBeDefined();
      expect(ms.github?.milestone_id).toBeDefined();
    }
    for (const epic of tree.epics) {
      expect(epic.github).toBeDefined();
      expect(epic.github?.issue_number).toBeDefined();
    }
    for (const story of tree.stories) {
      expect(story.github).toBeDefined();
      expect(story.github?.issue_number).toBeDefined();
    }

    // Verify sync state was created
    const stateResult = await loadState(metaDir);
    expect(stateResult.ok).toBe(true);
    if (!stateResult.ok) return;
    expect(stateResult.value.repo).toBe(repo);
    const entityCount = Object.keys(stateResult.value.entities).length;
    expect(entityCount).toBe(8); // 2 milestones + 2 epics + 4 stories

    // --- Step 4: Push (dry-run) ---
    const pushResult = await exportToGitHub({
      token,
      repo,
      metaDir,
      dryRun: true,
    });
    expect(pushResult.ok).toBe(true);
    if (!pushResult.ok) return;
    // After import, entities already have GitHub IDs — no new creations expected
    expect(pushResult.value.created.issues).toBe(0);
    expect(pushResult.value.created.milestones).toBe(0);
    // Dry run should not call GitHub API
    expect(mockCreateIssue).not.toHaveBeenCalled();
    expect(mockCreateMilestone).not.toHaveBeenCalled();

    // --- Step 5: Sync (dry-run) ---
    const syncResult = await syncWithGitHub({
      token,
      repo,
      metaDir,
      strategy: 'local-wins',
      dryRun: true,
    });
    expect(syncResult.ok).toBe(true);
    if (!syncResult.ok) return;
    expect(syncResult.value.conflicts).toHaveLength(0);

    // --- Step 6: Actual push (should be no-op since data matches) ---
    const realPushResult = await exportToGitHub({ token, repo, metaDir });
    expect(realPushResult.ok).toBe(true);

    // Verify state is preserved after push
    const finalState = await loadState(metaDir);
    expect(finalState.ok).toBe(true);
    if (finalState.ok) {
      expect(Object.keys(finalState.value.entities).length).toBe(entityCount);
    }
  });

  it('import → modify locally → push detects changes', async () => {
    // Import
    const importResult = await importFromGitHub({ token, repo, metaDir });
    expect(importResult.ok).toBe(true);

    // Parse tree and find a story to modify
    const treeResult = await parseTree(metaDir);
    expect(treeResult.ok).toBe(true);
    if (!treeResult.ok) return;

    const story = treeResult.value.stories[0];
    expect(story).toBeDefined();
    expect(story.filePath).toBeTruthy();

    // Modify the story file on disk (change title)
    // filePath from parseTree is absolute
    const storyPath = story.filePath;
    const content = await readFile(storyPath, 'utf-8');
    const modified = content.replace(story.title, `${story.title} (updated)`);
    const { writeFile: fsWrite } = await import('node:fs/promises');
    await fsWrite(storyPath, modified);

    // Push should detect the modification
    const pushResult = await exportToGitHub({ token, repo, metaDir });
    expect(pushResult.ok).toBe(true);
    if (pushResult.ok) {
      // At least one entity should be updated
      expect(
        pushResult.value.updated.issues + pushResult.value.updated.milestones,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('import is idempotent — second import overwrites cleanly', async () => {
    // First import
    const first = await importFromGitHub({ token, repo, metaDir });
    expect(first.ok).toBe(true);

    // Second import into same dir
    const second = await importFromGitHub({ token, repo, metaDir });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    // Same counts
    expect(second.value.milestones).toBe(2);
    expect(second.value.epics).toBe(2);
    expect(second.value.stories).toBe(4);

    // Tree still validates
    const treeResult = await parseTree(metaDir);
    expect(treeResult.ok).toBe(true);
    if (!treeResult.ok) return;
    const resolved = resolveRefs(treeResult.value);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const validation = validateTree(resolved.value);
    expect(validation.errors).toHaveLength(0);
  });
});
