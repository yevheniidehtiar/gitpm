import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTree } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixtureIssues from '../__fixtures__/github-issues.json';
import fixtureMilestones from '../__fixtures__/github-milestones.json';
import type { GhIssue, GhMilestone } from '../client.js';
import { importFromGitHub } from '../import.js';
import type { ImportOptions } from '../types.js';

// Mock the GitHubClient
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
      };
    }),
  };
});

describe('importFromGitHub', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-import-test-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const defaultOptions: ImportOptions = {
    token: 'test-token',
    repo: 'test-org/test-repo',
    metaDir: '', // set in beforeEach
  };

  it('imports milestones, epics, and stories from GitHub', async () => {
    const options = { ...defaultOptions, metaDir };

    const result = await importFromGitHub(options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.milestones).toBe(2);
    expect(result.value.epics).toBe(2);
    expect(result.value.stories).toBe(4); // issues 3,4,5,6 (PR filtered out)
    expect(result.value.totalFiles).toBeGreaterThan(0);
  });

  it('creates a valid .meta tree', async () => {
    const options = { ...defaultOptions, metaDir };

    const importResult = await importFromGitHub(options);
    expect(importResult.ok).toBe(true);

    // Parse the generated tree
    const treeResult = await parseTree(metaDir);
    expect(treeResult.ok).toBe(true);
    if (!treeResult.ok) return;
    const tree = treeResult.value;
    expect(tree.errors).toHaveLength(0);
    expect(tree.milestones.length).toBe(2);
    expect(tree.epics.length).toBe(2);
    expect(tree.stories.length).toBe(4);
    expect(tree.roadmaps.length).toBe(1);
  });

  it('creates github-config.yaml', async () => {
    const options = { ...defaultOptions, metaDir };

    await importFromGitHub(options);

    const configPath = join(metaDir, 'sync', 'github-config.yaml');
    const content = await readFile(configPath, 'utf-8');
    expect(content).toContain('test-org/test-repo');
    expect(content).toContain('status_mapping');
  });

  it('creates github-state.json with entries for all entities', async () => {
    const options = { ...defaultOptions, metaDir };

    await importFromGitHub(options);

    const statePath = join(metaDir, 'sync', 'github-state.json');
    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content);
    expect(state.repo).toBe('test-org/test-repo');
    // milestones + epics + stories = 2 + 2 + 4 = 8
    expect(Object.keys(state.entities).length).toBe(8);
  });

  it('populates github sync metadata on every entity', async () => {
    const options = { ...defaultOptions, metaDir };

    await importFromGitHub(options);
    const treeResult = await parseTree(metaDir);
    expect(treeResult.ok).toBe(true);
    if (!treeResult.ok) return;
    const tree = treeResult.value;

    for (const ms of tree.milestones) {
      expect(ms.github).toBeDefined();
      expect(ms.github?.repo).toBe('test-org/test-repo');
      expect(ms.github?.milestone_id).toBeDefined();
    }
    for (const epic of tree.epics) {
      expect(epic.github).toBeDefined();
      expect(epic.github?.repo).toBe('test-org/test-repo');
      expect(epic.github?.issue_number).toBeDefined();
    }
    for (const story of tree.stories) {
      expect(story.github).toBeDefined();
      expect(story.github?.repo).toBe('test-org/test-repo');
      expect(story.github?.issue_number).toBeDefined();
    }
  });

  it('returns error for invalid repo format', async () => {
    const options = { ...defaultOptions, metaDir, repo: 'invalid' };
    const result = await importFromGitHub(options);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid repo format');
    }
  });

  it('links stories to epics via body references', async () => {
    const options = { ...defaultOptions, metaDir };

    await importFromGitHub(options);
    const treeResult = await parseTree(metaDir);
    expect(treeResult.ok).toBe(true);
    if (!treeResult.ok) return;
    const tree = treeResult.value;

    // Issues #3 and #4 reference #1 (epic) in their body
    const storiesWithEpicRef = tree.stories.filter(
      (s) => s.epic_ref !== null && s.epic_ref !== undefined,
    );
    expect(storiesWithEpicRef.length).toBeGreaterThanOrEqual(2);
  });

  it('works with no milestones', async () => {
    // Re-mock to return empty milestones
    const { GitHubClient } = await import('../client.js');
    vi.mocked(GitHubClient).mockImplementation(function () {
      return {
        listMilestones: vi.fn().mockResolvedValue([]),
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
      } as never;
    });

    const options = { ...defaultOptions, metaDir };
    const result = await importFromGitHub(options);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.milestones).toBe(0);
    }
  });
});
