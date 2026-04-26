import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTree, resolveRefs, validateTree } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import issueFixtures from '../__fixtures__/gitlab-issues.json';
import milestoneFixtures from '../__fixtures__/gitlab-milestones.json';
import { importFromGitLab } from '../import.js';

const getProject = vi.fn();
const listMilestones = vi.fn();
const listIssues = vi.fn();
const listGroupEpics = vi.fn();
const listEpicIssues = vi.fn();

// Mock GitLabClient
vi.mock('../client.js', () => {
  return {
    GitLabClient: vi.fn().mockImplementation(function () {
      return {
        getProject,
        listMilestones,
        listIssues,
        listGroupEpics,
        listEpicIssues,
      };
    }),
  };
});

describe('importFromGitLab', () => {
  let metaDir: string;

  beforeEach(async () => {
    metaDir = await mkdtemp(join(tmpdir(), 'gitpm-import-'));
    getProject.mockReset();
    listMilestones.mockReset();
    listIssues.mockReset();
    listGroupEpics.mockReset();
    listEpicIssues.mockReset();

    getProject.mockResolvedValue({
      id: 42,
      name: 'test-project',
      path_with_namespace: 'test-ns/test-project',
      namespace: { id: 10, kind: 'group', full_path: 'test-ns' },
    });
    listMilestones.mockResolvedValue(milestoneFixtures);
    listIssues.mockResolvedValue(issueFixtures);
    listGroupEpics.mockResolvedValue([]);
    listEpicIssues.mockResolvedValue([]);
  });

  afterEach(async () => {
    await rm(metaDir, { recursive: true });
  });

  it('imports milestones, epics, and stories', async () => {
    const result = await importFromGitLab({
      token: 'test-token',
      project: 'test-ns/test-project',
      metaDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 2 milestones from fixture
    expect(result.value.milestones).toBe(2);
    // 2 epics (issues with 'epic' label: iid 1 and 2)
    expect(result.value.epics).toBe(2);
    // 3 stories (issues without 'epic' label: iid 3, 4, 5)
    expect(result.value.stories).toBe(3);
    // total files = milestones + epics + stories + roadmap + config + state
    expect(result.value.totalFiles).toBe(2 + 2 + 3 + 1 + 1 + 1);
    expect(result.value.writtenPaths).toHaveLength(8);
    expect(result.value.writtenPaths.every((p) => p.startsWith('.meta/'))).toBe(
      true,
    );
  });

  it('creates valid tree structure', async () => {
    const result = await importFromGitLab({
      token: 'test-token',
      project: 'test-ns/test-project',
      metaDir,
    });
    expect(result.ok).toBe(true);

    const treeResult = await parseTree(metaDir);
    expect(treeResult.ok).toBe(true);
    if (!treeResult.ok) return;

    const tree = treeResult.value;
    expect(tree.milestones.length).toBe(2);
    expect(tree.epics.length).toBe(2);

    const resolved = resolveRefs(tree);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const validation = validateTree(resolved.value);
    expect(validation.errors).toHaveLength(0);
  });

  it('fetches and incorporates native GitLab epics with link relationships', async () => {
    const nativeEpic = {
      id: 501,
      iid: 11,
      group_id: 10,
      title: 'Platform Migration',
      description: 'Migrate platform.',
      state: 'opened' as const,
      labels: ['platform'],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    listGroupEpics.mockResolvedValueOnce([nativeEpic]);
    listEpicIssues.mockResolvedValueOnce([
      {
        id: 1,
        iid: 3,
        title: 't',
        description: null,
        state: 'opened',
        assignee: null,
        labels: [],
        milestone: null,
        weight: null,
        epic_iid: 11,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const result = await importFromGitLab({
      token: 'test-token',
      project: 'test-ns/test-project',
      metaDir,
      linkStrategy: 'all',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2 epics from label-based + 1 native epic = 3
    expect(result.value.epics).toBe(3);
    expect(listGroupEpics).toHaveBeenCalledWith(10);
    expect(listEpicIssues).toHaveBeenCalledWith(10, 11);
  });

  it('skips native epic issue fetching for non-matching strategies', async () => {
    const nativeEpic = {
      id: 501,
      iid: 11,
      group_id: 10,
      title: 'Platform',
      description: null,
      state: 'opened' as const,
      labels: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    listGroupEpics.mockResolvedValueOnce([nativeEpic]);

    const result = await importFromGitLab({
      token: 'test-token',
      project: 'test-ns/test-project',
      metaDir,
      linkStrategy: 'body-refs',
    });
    expect(result.ok).toBe(true);
    expect(listEpicIssues).not.toHaveBeenCalled();
  });

  it('accepts explicit projectId without resolving via getProject', async () => {
    const result = await importFromGitLab({
      token: 'test-token',
      project: 'test-ns/test-project',
      projectId: 42,
      metaDir,
    });
    expect(result.ok).toBe(true);
    expect(getProject).not.toHaveBeenCalled();
  });

  it('handles user namespace (skips groupId)', async () => {
    getProject.mockResolvedValueOnce({
      id: 42,
      name: 'test-project',
      path_with_namespace: 'user/test-project',
      namespace: { id: 99, kind: 'user', full_path: 'user' },
    });
    const result = await importFromGitLab({
      token: 'test-token',
      project: 'user/test-project',
      metaDir,
    });
    expect(result.ok).toBe(true);
  });

  it('returns error Result when client rejects', async () => {
    getProject.mockRejectedValueOnce(new Error('API failed'));
    const result = await importFromGitLab({
      token: 'test-token',
      project: 'test-ns/test-project',
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/API failed/);
  });

  it('creates config and state files', async () => {
    const result = await importFromGitLab({
      token: 'test-token',
      project: 'test-ns/test-project',
      metaDir,
    });
    expect(result.ok).toBe(true);

    // Verify config exists
    const { readFile } = await import('node:fs/promises');
    const configRaw = await readFile(
      join(metaDir, 'sync', 'gitlab-config.yaml'),
      'utf-8',
    );
    expect(configRaw).toContain('test-ns/test-project');

    // Verify state exists
    const stateRaw = await readFile(
      join(metaDir, 'sync', 'gitlab-state.json'),
      'utf-8',
    );
    const state = JSON.parse(stateRaw);
    expect(state.project).toBe('test-ns/test-project');
    expect(Object.keys(state.entities).length).toBeGreaterThan(0);
  });
});
