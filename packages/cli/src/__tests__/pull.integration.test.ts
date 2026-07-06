/**
 * Integration test for `gitpm pull`.
 *
 * Mocking strategy: see `./helpers/mock-github-fetch.ts` — we stub the
 * process-global `fetch` so the real adapter (`resolveAdapter` → real
 * `githubAdapter.sync` → `syncWithGitHub` → `GitHubClient`) runs against a
 * real temp `.meta/` tree plus a real `sync/github-state.json` state file
 * (shape taken from `packages/sync-github/src/state.ts` /
 * `SyncState`/`SyncStateEntry`). `gitpm pull` always calls the adapter's
 * `sync()` with the configured strategy (default `remote-wins`) — pulling
 * is "sync biased toward the remote".
 */
import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { computeContentHash, remoteIssueFields } from '@gitpm/sync-github';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTempProject,
  writeEntityFile,
  writeGithubSyncConfig,
} from './helpers/meta-tree.js';
import type {
  GhIssueFixture,
  MockGithubFetchController,
} from './helpers/mock-github-fetch.js';
import { installMockGithubFetch } from './helpers/mock-github-fetch.js';

let logSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let fetchMock: MockGithubFetchController;

async function run(...args: string[]) {
  const { pullCommand } = await import('../commands/pull.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(pullCommand);
  await program.parseAsync(['node', 'gitpm', 'pull', ...args]);
}

/** Matches `computeRemoteIssueHash` in `packages/sync-github/src/sync.ts`. */
function hashRemoteIssue(gh: GhIssueFixture): string {
  const json = JSON.stringify(remoteIssueFields(gh));
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}

const STORY_FRONTMATTER = {
  type: 'story' as const,
  id: 'st_widget',
  title: 'Original widget title',
  status: 'todo' as const,
  priority: 'medium' as const,
  assignee: 'alice',
  labels: ['backend'],
  epic_ref: null,
  github: {
    issue_number: 42,
    repo: 'acme/widgets',
    synced_at: '2026-04-01T00:00:00Z',
  },
};
const STORY_BODY = 'Original widget description.';

const REMOTE_ISSUE: GhIssueFixture = {
  number: 42,
  title: 'Remote-updated widget title',
  body: 'Remote-updated widget description.',
  state: 'open',
  assignee: { login: 'carol' },
  labels: [{ name: 'backend' }, { name: 'urgent' }],
  milestone: null,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-02T00:00:00Z',
};

describe('gitpm pull (integration, mocked at the fetch layer)', () => {
  let rootDir: string;
  let metaDir: string;
  let storyPath: string;
  let originalLocalHash: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ rootDir, metaDir } = await createTempProject('gitpm-pull-'));

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    fetchMock = installMockGithubFetch();
    await writeGithubSyncConfig(metaDir, 'acme/widgets');

    storyPath = join(metaDir, 'stories', 'widget.md');
    await writeEntityFile(storyPath, STORY_FRONTMATTER, STORY_BODY);

    // The stored baseline hashes reflect the entity exactly as authored
    // above, so the remote-only change below is unambiguously "remote
    // changed, local unchanged".
    originalLocalHash = computeContentHash({
      ...STORY_FRONTMATTER,
      body: STORY_BODY,
      filePath: storyPath,
    } as never);

    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir(join(metaDir, 'sync'), { recursive: true });
    await writeFile(
      join(metaDir, 'sync', 'github-state.json'),
      `${JSON.stringify(
        {
          repo: 'acme/widgets',
          last_sync: '2026-04-01T00:00:00Z',
          entities: {
            st_widget: {
              github_issue_number: 42,
              local_hash: originalLocalHash,
              remote_hash: originalLocalHash,
              synced_at: '2026-04-01T00:00:00Z',
            },
          },
        },
        null,
        2,
      )}\n`,
      'utf-8',
    );

    // The remote issue has since changed (new title/body/labels/assignee).
    fetchMock.setIssueByNumber(REMOTE_ISSUE, 42);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await rm(rootDir, { recursive: true, force: true });
  });

  it('pulls the remote change onto disk with the default (remote-wins) strategy', async () => {
    await run('--token', 'mock-token', '--meta-dir', metaDir);

    expect(exitSpy).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Pull Summary');

    const updatedContent = await readFile(storyPath, 'utf-8');
    expect(updatedContent).toContain('Remote-updated widget title');
    expect(updatedContent).toContain('status: todo');
    expect(updatedContent).toContain('assignee: carol');

    // Sync state was updated in place — both the recomputed local hash
    // (post-merge content) and the remote hash (of the fetched issue) moved
    // off their original shared baseline.
    const state = JSON.parse(
      await readFile(join(metaDir, 'sync', 'github-state.json'), 'utf-8'),
    );
    const entry = state.entities.st_widget;
    expect(entry.local_hash).not.toBe(originalLocalHash);
    expect(entry.remote_hash).toBe(hashRemoteIssue(REMOTE_ISSUE));
  });
});
