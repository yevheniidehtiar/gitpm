import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockParseTree = vi.fn();
const mockResolveRefs = vi.fn();
const mockComputeMilestoneProgress = vi.fn();
const mockComputeEpicProgress = vi.fn();

vi.mock('@gitpm/core', () => ({
  parseTree: (...args: unknown[]) => mockParseTree(...args),
  resolveRefs: (...args: unknown[]) => mockResolveRefs(...args),
  computeMilestoneProgress: (...args: unknown[]) =>
    mockComputeMilestoneProgress(...args),
  computeEpicProgress: (...args: unknown[]) => mockComputeEpicProgress(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { contextCommand } = await import('../commands/context.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(contextCommand);
  await program.parseAsync(['node', 'gitpm', 'context', ...args]);
}

function emptyTree() {
  return {
    stories: [],
    epics: [],
    milestones: [],
    roadmaps: [],
    prds: [],
    sprints: [],
    errors: [],
  };
}

function makeTree() {
  const epicActive = {
    id: 'ep_1',
    title: 'Auth Epic',
    status: 'in_progress',
    resolvedStories: [],
  };
  const epicDone = {
    id: 'ep_2',
    title: 'Done Epic',
    status: 'done',
    resolvedStories: [],
  };

  return {
    stories: [
      {
        id: 'st_1',
        title: 'Blocked story',
        status: 'todo',
        assignee: null,
        resolvedEpic: { title: 'Auth Epic' },
      },
      {
        id: 'st_2',
        title: 'Assigned story',
        status: 'todo',
        assignee: 'alice',
        resolvedEpic: undefined,
      },
      {
        id: 'st_3',
        title: 'Active story',
        status: 'in_progress',
        assignee: null,
        resolvedEpic: undefined,
      },
    ],
    epics: [epicActive, epicDone],
    milestones: [
      {
        id: 'ms_1',
        title: 'v1.0',
        status: 'in_progress',
        target_date: '2026-08-01',
      },
      {
        id: 'ms_2',
        title: 'Shipped',
        status: 'done',
        target_date: '2026-01-01',
      },
    ],
    roadmaps: [],
    prds: [],
    sprints: [
      {
        id: 'sp_1',
        title: 'Sprint 12',
        start_date: '2026-07-01',
        end_date: '2026-07-14',
        resolvedStories: [
          { id: 'st_a', title: 'a', status: 'done' },
          { id: 'st_b', title: 'b', status: 'todo' },
        ],
      },
    ],
    errors: [],
  };
}

// --- Tests ---

describe('gitpm context', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-06T00:00:00Z'));
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-cli-context-'));
    originalCwd = process.cwd();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    mockParseTree.mockResolvedValue({ ok: true, value: {} });
    mockResolveRefs.mockReturnValue({ ok: true, value: emptyTree() });
    mockComputeMilestoneProgress.mockReturnValue({
      milestoneId: 'ms_1',
      title: 'v1.0',
      targetDate: '2026-08-01',
      epics: [],
      total: 10,
      done: 6,
      progress: 0.6,
    });
    mockComputeEpicProgress.mockImplementation((epic: { id: string }) => {
      if (epic.id === 'ep_1') {
        return {
          epicId: 'ep_1',
          title: 'Auth Epic',
          status: 'in_progress',
          total: 4,
          done: 2,
          inProgress: 1,
          blocked: 1,
          progress: 0.5,
        };
      }
      return {
        epicId: epic.id,
        title: 'Unknown',
        status: 'done',
        total: 0,
        done: 0,
        inProgress: 0,
        blocked: 0,
        progress: 0,
      };
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('exits 1 when parseTree fails', async () => {
    mockParseTree.mockResolvedValue({
      ok: false,
      error: { message: 'parse err' },
    });
    await expect(run('--meta-dir', '/tmp/m')).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when resolveRefs fails', async () => {
    mockResolveRefs.mockReturnValue({
      ok: false,
      error: { message: 'resolve err' },
    });
    await expect(run('--meta-dir', '/tmp/m')).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('renders context markdown to stdout', async () => {
    mockResolveRefs.mockReturnValue({ ok: true, value: makeTree() });

    await run('--meta-dir', tmpDir);

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('## Project Context (generated by gitpm)');
    expect(logOutput).toContain('### Active Milestone');
    expect(logOutput).toContain('v1.0');
    expect(logOutput).toContain('60%');
    expect(logOutput).toContain('6/10 stories');
    expect(logOutput).toContain('due 2026-08-01');
    expect(logOutput).toContain('### Current Sprint');
    expect(logOutput).toContain('Sprint 12');
    expect(logOutput).toContain('1/2 stories done');
    expect(logOutput).toContain('### Active Epics');
    expect(logOutput).toContain('Auth Epic');
    expect(logOutput).toContain('2/4 done');
    expect(logOutput).not.toContain('Done Epic');
    expect(logOutput).toContain('### Blocked Items');
    expect(logOutput).toContain('Blocked story');
    expect(logOutput).not.toContain('Assigned story');
    expect(logOutput).not.toContain('Active story');
  });

  it('writes context to a file with --output', async () => {
    mockResolveRefs.mockReturnValue({ ok: true, value: makeTree() });
    const outFile = join(tmpDir, 'context.md');

    await run('--meta-dir', tmpDir, '--output', outFile);

    const content = await readFile(outFile, 'utf-8');
    expect(content).toContain('## Project Context (generated by gitpm)');
    expect(content).toContain('Auth Epic');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Wrote context to');
  });

  it('splices context into an existing ./CLAUDE.md with --update', async () => {
    mockResolveRefs.mockReturnValue({ ok: true, value: makeTree() });
    process.chdir(tmpDir);
    const claudeMdPath = join(tmpDir, 'CLAUDE.md');
    await writeFile(
      claudeMdPath,
      '# My Project\n\nSome important content.\n',
      'utf-8',
    );

    await run('--meta-dir', tmpDir, '--update');

    const content = await readFile(claudeMdPath, 'utf-8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Some important content.');
    expect(content).toContain('<!-- gitpm:context:start -->');
    expect(content).toContain('<!-- gitpm:context:end -->');
    expect(content).toContain('## Project Context (generated by gitpm)');
    expect(content).toContain('Auth Epic');
  });

  it('replaces only the marked section on repeated --update runs', async () => {
    mockResolveRefs.mockReturnValue({ ok: true, value: makeTree() });
    process.chdir(tmpDir);
    const claudeMdPath = join(tmpDir, 'CLAUDE.md');
    await writeFile(
      claudeMdPath,
      [
        '# My Project',
        '',
        '<!-- gitpm:context:start -->',
        'stale content that should be replaced',
        '<!-- gitpm:context:end -->',
        '',
        'Trailing content preserved after the block.',
        '',
      ].join('\n'),
      'utf-8',
    );

    await run('--meta-dir', tmpDir, '--update');

    const content = await readFile(claudeMdPath, 'utf-8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Trailing content preserved after the block.');
    expect(content).not.toContain('stale content that should be replaced');
    expect(content).toContain('## Project Context (generated by gitpm)');
    expect(content.match(/<!-- gitpm:context:start -->/g)).toHaveLength(1);
    expect(content.match(/<!-- gitpm:context:end -->/g)).toHaveLength(1);
  });

  it('creates ./CLAUDE.md with a marker section when the file is absent', async () => {
    mockResolveRefs.mockReturnValue({ ok: true, value: makeTree() });
    process.chdir(tmpDir);
    const claudeMdPath = join(tmpDir, 'CLAUDE.md');

    await run('--meta-dir', tmpDir, '--update');

    const content = await readFile(claudeMdPath, 'utf-8');
    expect(content).toContain('<!-- gitpm:context:start -->');
    expect(content).toContain('<!-- gitpm:context:end -->');
    expect(content).toContain('## Project Context (generated by gitpm)');
  });

  it('handles an empty tree gracefully', async () => {
    mockResolveRefs.mockReturnValue({ ok: true, value: emptyTree() });

    await run('--meta-dir', tmpDir);

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('No active milestone.');
    expect(logOutput).toContain('No sprint currently active.');
    expect(logOutput).toContain('No active epics.');
    expect(logOutput).toContain('None.');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
