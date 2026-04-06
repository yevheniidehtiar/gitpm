import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTree, resolveRefs, validateTree } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import issueFixtures from '../__fixtures__/gitlab-issues.json';
import milestoneFixtures from '../__fixtures__/gitlab-milestones.json';
import { importFromGitLab } from '../import.js';

// Mock GitLabClient
vi.mock('../client.js', () => {
  return {
    GitLabClient: vi.fn().mockImplementation(function () {
      return {
        getProject: vi.fn().mockResolvedValue({
          id: 42,
          name: 'test-project',
          path_with_namespace: 'test-ns/test-project',
          namespace: { id: 10, kind: 'group', full_path: 'test-ns' },
        }),
        listMilestones: vi.fn().mockResolvedValue(milestoneFixtures),
        listIssues: vi.fn().mockResolvedValue(issueFixtures),
        listGroupEpics: vi.fn().mockResolvedValue([]),
        listEpicIssues: vi.fn().mockResolvedValue([]),
      };
    }),
  };
});

describe('importFromGitLab', () => {
  let metaDir: string;

  beforeEach(async () => {
    metaDir = await mkdtemp(join(tmpdir(), 'gitpm-import-'));
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
