/**
 * Integration test for `gitpm import --source github`.
 *
 * Mocking strategy: we stub the global `fetch` (see
 * `./helpers/mock-github-fetch.ts` for the full rationale), NOT
 * `@gitpm/sync-github`'s adapter/import code. `gitpm import` dynamically
 * loads the real `@gitpm/sync-github` package via `@gitpm/core`'s
 * `loadAdapters`, so the real `importFromGitHub` → `GitHubClient` →
 * `@octokit/rest` code path runs end-to-end and writes real files into a
 * temp `.meta/` directory — only the network call itself is stubbed.
 */
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixtureIssuesJson from '../../../sync-github/src/__fixtures__/github-issues.json';
import fixtureMilestonesJson from '../../../sync-github/src/__fixtures__/github-milestones.json';
import { createTempProject } from './helpers/meta-tree.js';
import type {
  GhIssueFixture,
  GhMilestoneFixture,
  MockGithubFetchController,
} from './helpers/mock-github-fetch.js';
import { installMockGithubFetch } from './helpers/mock-github-fetch.js';

// Integration tests load the real adapter module graph per test; the 5s
// default flakes under full-suite transform load while passing in isolation.
vi.setConfig({ testTimeout: 30_000 });

const fixtureIssues = fixtureIssuesJson as GhIssueFixture[];
const fixtureMilestones = fixtureMilestonesJson as GhMilestoneFixture[];

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let fetchMock: MockGithubFetchController;

async function run(...args: string[]) {
  const { importCommand } = await import('../commands/import.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(importCommand);
  await program.parseAsync(['node', 'gitpm', 'import', ...args]);
}

describe('gitpm import (integration, mocked at the fetch layer)', () => {
  let rootDir: string;
  let metaDir: string;

  beforeEach(async () => {
    vi.resetModules();
    ({ rootDir, metaDir } = await createTempProject('gitpm-import-'));

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    fetchMock = installMockGithubFetch();
    fetchMock.setMilestones(fixtureMilestones);
    fetchMock.setIssues(fixtureIssues);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await rm(rootDir, { recursive: true, force: true });
  });

  it('imports real GitHub fixture data into a temp .meta/ tree', async () => {
    await run(
      '--repo',
      'test-org/test-repo',
      '--token',
      'mock-token',
      '--meta-dir',
      metaDir,
    );

    expect(exitSpy).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');

    // 2 milestones (open + closed), 2 epics (labeled "epic"), 4 stories
    // (PR + no-body issue filtered/attributed) — matches github-issues.json.
    expect(allOutput).toContain('Milestones: 2');
    expect(allOutput).toContain('Epics:      2');
    expect(allOutput).toContain('Stories:    4');

    // Real files were written to disk by the real sync-github adapter.
    const epicPath = join(metaDir, 'epics', 'balancing-engine', 'epic.md');
    const epicContent = await readFile(epicPath, 'utf-8');
    expect(epicContent).toContain('type: epic');
    expect(epicContent).toContain('title: Balancing Engine');
    expect(epicContent).toContain('status: todo');

    const milestonePath = join(
      metaDir,
      'roadmap',
      'milestones',
      'q2-2026-launch.md',
    );
    const milestoneContent = await readFile(milestonePath, 'utf-8');
    expect(milestoneContent).toContain('type: milestone');
    expect(milestoneContent).toContain('milestone_id: 1');

    // A GitHub-synced story should have github frontmatter with an issue number.
    const storyPath = join(
      metaDir,
      'epics',
      'balancing-engine',
      'stories',
      'price-feed-ingestion.md',
    );
    const storyContent = await readFile(storyPath, 'utf-8');
    expect(storyContent).toContain('type: story');
    expect(storyContent).toContain('issue_number: 3');

    // Sync state was persisted by the real adapter.
    const statePath = join(metaDir, 'sync', 'github-state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(state.repo).toBe('test-org/test-repo');
    expect(Object.keys(state.entities).length).toBeGreaterThan(0);
  });

  it('exits 1 when the GitHub API call fails', async () => {
    fetchMock.failAllRequestsWith('GitHub API is down');

    await expect(
      run(
        '--repo',
        'test-org/test-repo',
        '--token',
        'mock-token',
        '--meta-dir',
        metaDir,
      ),
    ).rejects.toThrow('process.exit');

    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('GitHub API is down');
  });
});
