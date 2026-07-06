/**
 * Integration test for `gitpm validate`.
 *
 * Unlike `validate.test.ts` (which mocks `@gitpm/core` entirely), this test
 * builds real temp `.meta/` trees on disk via `mkdtemp` and runs the real
 * `parseTree` / `resolveRefs` / `validateTree` pipeline from `@gitpm/core`
 * against them — no mocking at all. This closes the "tests use temp dirs"
 * gap called out in story #30 for the `validate` command.
 */
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTempProject,
  writeEntityFile,
  writeRoadmapFile,
} from './helpers/meta-tree.js';

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { validateCommand } = await import('../commands/validate.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(validateCommand);
  await program.parseAsync(['node', 'gitpm', 'validate', ...args]);
}

describe('gitpm validate (integration, real .meta tree)', () => {
  let rootDir: string;
  let metaDir: string;

  beforeEach(() => {
    vi.resetModules();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it('reports a valid tree as valid (roadmap + milestone + epic + story)', async () => {
    ({ rootDir, metaDir } = await createTempProject('gitpm-validate-valid-'));

    await writeRoadmapFile(join(metaDir, 'roadmap', 'roadmap.yaml'), {
      type: 'roadmap',
      id: 'rm_main',
      title: 'Integration Test Roadmap',
      description: 'Roadmap for the validate integration test.',
      milestones: [{ id: 'ms_q2' }],
      updated_at: '2026-03-15T10:00:00Z',
    });

    await writeEntityFile(
      join(metaDir, 'roadmap', 'milestones', 'q2-launch.md'),
      {
        type: 'milestone',
        id: 'ms_q2',
        title: 'Q2 Launch',
        target_date: '2026-06-30',
        status: 'in_progress',
        created_at: '2026-01-10T09:00:00Z',
        updated_at: '2026-03-15T10:00:00Z',
      },
      'Key objectives for Q2.',
    );

    await writeEntityFile(
      join(metaDir, 'epics', 'balancing-engine', 'epic.md'),
      {
        type: 'epic',
        id: 'ep_balancing',
        title: 'Balancing Engine v1',
        status: 'in_progress',
        priority: 'critical',
        owner: 'dmytro',
        labels: ['core'],
        milestone_ref: { id: 'ms_q2' },
        created_at: '2026-02-15T09:00:00Z',
        updated_at: '2026-03-15T10:00:00Z',
      },
      'Build the core balancing engine.',
    );

    await writeEntityFile(
      join(metaDir, 'epics', 'balancing-engine', 'stories', 'price-feed.md'),
      {
        type: 'story',
        id: 'st_price_feed',
        title: 'Implement price feed ingestion',
        status: 'in_progress',
        priority: 'high',
        assignee: 'john',
        labels: ['backend'],
        estimate: 5,
        epic_ref: { id: 'ep_balancing' },
        created_at: '2026-03-01T09:00:00Z',
        updated_at: '2026-03-15T10:00:00Z',
      },
      'Connect to the price feed API.',
    );

    await run('--meta-dir', metaDir);

    expect(exitSpy).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('is valid');
    expect(allOutput).toContain('4 entities'); // roadmap + milestone + epic + story
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('reports an invalid tree as invalid (bad status value + missing required field)', async () => {
    ({ rootDir, metaDir } = await createTempProject('gitpm-validate-invalid-'));

    // Missing required "title" field.
    await writeEntityFile(join(metaDir, 'stories', 'no-title.md'), {
      type: 'story',
      id: 'st_no_title',
      status: 'todo',
      priority: 'medium',
    });

    // Invalid "status" enum value.
    await writeEntityFile(join(metaDir, 'stories', 'bad-status.md'), {
      type: 'story',
      id: 'st_bad_status',
      title: 'Story with a bogus status',
      status: 'not-a-real-status',
      priority: 'medium',
    });

    await expect(run('--meta-dir', metaDir)).rejects.toThrow('process.exit');

    expect(exitSpy).toHaveBeenCalledWith(1);
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    // Both bad files should surface as parse errors under their filenames.
    expect(allOutput).toContain('no-title.md');
    expect(allOutput).toContain('bad-status.md');
  });
});
