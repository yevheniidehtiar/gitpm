/**
 * Integration test for `gitpm push`.
 *
 * Mocking strategy: see `./helpers/mock-github-fetch.ts` for the full
 * rationale — we stub the process-global `fetch` (the layer
 * `@octokit/request` actually calls), not `@gitpm/sync-github` itself, so
 * the real adapter (`resolveAdapter` → real `githubAdapter.export` →
 * `exportToGitHub` → `GitHubClient` → `@octokit/rest`) runs against a real
 * temp `.meta/` tree built on disk. We assert on the exact payloads the
 * mocked GitHub API received (title, body, labels, state).
 */
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTempProject,
  writeEntityFile,
  writeGithubSyncConfig,
} from './helpers/meta-tree.js';
import type { MockGithubFetchController } from './helpers/mock-github-fetch.js';
import { installMockGithubFetch } from './helpers/mock-github-fetch.js';

// Integration tests load the real adapter module graph per test; the 5s
// default flakes under full-suite transform load while passing in isolation.
vi.setConfig({ testTimeout: 30_000 });

const mockConfirm = vi.fn();
vi.mock('@inquirer/prompts', () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let fetchMock: MockGithubFetchController;

async function run(...args: string[]) {
  const { pushCommand } = await import('../commands/push.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(pushCommand);
  await program.parseAsync(['node', 'gitpm', 'push', ...args]);
}

describe('gitpm push (integration, mocked at the fetch layer)', () => {
  let rootDir: string;
  let metaDir: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ rootDir, metaDir } = await createTempProject('gitpm-push-'));

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    fetchMock = installMockGithubFetch();
    await writeGithubSyncConfig(metaDir, 'acme/widgets');

    // Entities with no `github:` block — a first-time push.
    await writeEntityFile(
      join(metaDir, 'roadmap', 'milestones', 'launch.md'),
      {
        type: 'milestone',
        id: 'ms_launch',
        title: 'Launch',
        target_date: '2026-06-30',
        status: 'in_progress',
      },
      'Ship it.',
    );

    await writeEntityFile(
      join(metaDir, 'epics', 'checkout', 'epic.md'),
      {
        type: 'epic',
        id: 'ep_checkout',
        title: 'Checkout Flow',
        status: 'in_progress',
        priority: 'high',
        owner: 'alice',
        labels: ['backend'],
        milestone_ref: { id: 'ms_launch' },
      },
      'Build the checkout flow end to end.',
    );

    await writeEntityFile(
      join(metaDir, 'epics', 'checkout', 'stories', 'cart-total.md'),
      {
        type: 'story',
        id: 'st_cart_total',
        title: 'Compute cart total',
        status: 'done',
        priority: 'critical',
        assignee: 'bob',
        labels: ['pricing'],
        epic_ref: { id: 'ep_checkout' },
      },
      'Sum line items and apply discounts.',
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await rm(rootDir, { recursive: true, force: true });
  });

  it('creates new GitHub issues/milestones with the expected payloads', async () => {
    await run('--yes', '--token', 'mock-token', '--meta-dir', metaDir);

    expect(exitSpy).not.toHaveBeenCalled();

    // Dry-run preview + real push both ran against the mocked API.
    expect(fetchMock.createMilestone).toHaveBeenCalledTimes(1);
    expect(fetchMock.createMilestone).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Launch' }),
      expect.any(Number),
    );

    expect(fetchMock.createIssue).toHaveBeenCalledTimes(2);
    const [epicPayload, storyPayload] = fetchMock.createIssue.mock.calls.map(
      (call) => call[0],
    );

    expect(epicPayload).toMatchObject({
      title: 'Checkout Flow',
      body: 'Build the checkout flow end to end.',
      labels: expect.arrayContaining(['backend', 'epic']),
    });

    expect(storyPayload).toMatchObject({
      title: 'Compute cart total',
      body: 'Sum line items and apply discounts.',
      labels: expect.arrayContaining(['pricing']),
      assignees: ['bob'],
    });

    // The story is "done" locally — export.ts closes it via a follow-up
    // updateIssue call after creation (issue create can't set state).
    expect(fetchMock.updateIssue).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ state: 'closed' }),
    );

    // GitHub metadata was written back to the real files on disk.
    const storyContent = await readFile(
      join(metaDir, 'epics', 'checkout', 'stories', 'cart-total.md'),
      'utf-8',
    );
    expect(storyContent).toMatch(/issue_number: \d+/);
    expect(storyContent).toContain('repo: acme/widgets');
  });

  it('shows a dry-run preview without calling the GitHub API mutation endpoints', async () => {
    await run('--dry-run', '--token', 'mock-token', '--meta-dir', metaDir);

    expect(exitSpy).not.toHaveBeenCalled();
    expect(fetchMock.createIssue).not.toHaveBeenCalled();
    expect(fetchMock.createMilestone).not.toHaveBeenCalled();

    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('New milestones: 1');
    expect(allOutput).toContain('New issues:     2');
  });
});
