/**
 * Integration test for `gitpm sync` conflict resolution.
 *
 * Mocking strategy: see `./helpers/mock-github-fetch.ts` — we stub the
 * process-global `fetch` so the real adapter (`resolveAdapter` → real
 * `githubAdapter.sync` → `syncWithGitHub`) runs end to end. Each test builds
 * a real conflict: the local story field changes AND the remote issue
 * changes (to a *different* value) relative to the stored sync-state
 * baseline, which `diffByHash` (see `packages/sync-github/src/diff.ts`)
 * classifies as `'both_changed'` — a genuine conflict. We then run `gitpm
 * sync` once per resolution strategy accepted by the CLI
 * (`local-wins` / `remote-wins`, see `VALID_STRATEGIES` in
 * `packages/cli/src/commands/sync.ts`) and assert the on-disk outcome.
 */
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { computeContentHash } from '@gitpm/sync-github';
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

const mockConfirm = vi.fn();
vi.mock('@inquirer/prompts', () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let fetchMock: MockGithubFetchController;

async function run(...args: string[]) {
  const { syncCommand } = await import('../commands/sync.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(syncCommand);
  await program.parseAsync(['node', 'gitpm', 'sync', ...args]);
}

const BASE_FRONTMATTER = {
  type: 'story' as const,
  id: 'st_conflict',
  title: 'Baseline title',
  status: 'todo' as const,
  priority: 'medium' as const,
  assignee: 'alice',
  labels: ['backend'],
  epic_ref: null,
  github: {
    issue_number: 7,
    repo: 'acme/widgets',
    synced_at: '2026-04-01T00:00:00Z',
  },
};
const BASE_BODY = 'Baseline description.';

const REMOTE_ISSUE: GhIssueFixture = {
  number: 7,
  title: 'Remote-edited title',
  body: BASE_BODY,
  state: 'open',
  assignee: { login: 'alice' },
  labels: [{ name: 'backend' }],
  milestone: null,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-05T00:00:00Z',
};

/**
 * Build a temp `.meta/` project with one story that has diverged from the
 * sync-state baseline on *both* sides (a genuine conflict), plus a mocked
 * remote issue representing the other side of that conflict.
 */
async function setupConflictProject(): Promise<{
  rootDir: string;
  metaDir: string;
  storyPath: string;
}> {
  const { rootDir, metaDir } = await createTempProject('gitpm-sync-conflict-');
  await writeGithubSyncConfig(metaDir, 'acme/widgets');

  const storyPath = join(metaDir, 'stories', 'conflict.md');

  // The stored baseline hash matches the *original* (pre-edit) content.
  const baselineHash = computeContentHash({
    ...BASE_FRONTMATTER,
    body: BASE_BODY,
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
          st_conflict: {
            github_issue_number: 7,
            local_hash: baselineHash,
            remote_hash: baselineHash,
            synced_at: '2026-04-01T00:00:00Z',
          },
        },
      },
      null,
      2,
    )}\n`,
    'utf-8',
  );

  // Local edit: title changed locally, AFTER the state baseline was recorded.
  await writeEntityFile(
    storyPath,
    { ...BASE_FRONTMATTER, title: 'Locally-edited title' },
    BASE_BODY,
  );

  return { rootDir, metaDir, storyPath };
}

describe('gitpm sync (integration, conflict resolution)', () => {
  let rootDir: string;
  let metaDir: string;
  let storyPath: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    ({ rootDir, metaDir, storyPath } = await setupConflictProject());

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    fetchMock = installMockGithubFetch();
    fetchMock.setIssueByNumber(REMOTE_ISSUE, 7);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await rm(rootDir, { recursive: true, force: true });
  });

  it('keeps the local value and pushes it to GitHub with --strategy local-wins', async () => {
    await run(
      '--yes',
      '--strategy',
      'local-wins',
      '--token',
      'mock-token',
      '--meta-dir',
      metaDir,
    );

    expect(exitSpy).not.toHaveBeenCalled();

    const content = await readFile(storyPath, 'utf-8');
    expect(content).toContain('title: "Locally-edited title"');

    // Local-wins pushes the local value to GitHub.
    expect(fetchMock.updateIssue).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ title: 'Locally-edited title' }),
    );

    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Sync Complete');
  });

  it('overwrites the local file with the remote value with --strategy remote-wins', async () => {
    await run(
      '--yes',
      '--strategy',
      'remote-wins',
      '--token',
      'mock-token',
      '--meta-dir',
      metaDir,
    );

    expect(exitSpy).not.toHaveBeenCalled();

    const content = await readFile(storyPath, 'utf-8');
    expect(content).toContain('title: Remote-edited title');
    expect(content).not.toContain('Locally-edited title');

    // Remote-wins never pushes the (discarded) local edit.
    expect(fetchMock.updateIssue).not.toHaveBeenCalledWith(
      7,
      expect.objectContaining({ title: 'Locally-edited title' }),
    );
  });
});
