import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockParseTree = vi.fn();
const mockResolveRefs = vi.fn();
const mockComputeProjectProgress = vi.fn();

vi.mock('@gitpm/core', () => ({
  parseTree: (...args: unknown[]) => mockParseTree(...args),
  resolveRefs: (...args: unknown[]) => mockResolveRefs(...args),
  computeProjectProgress: (...args: unknown[]) =>
    mockComputeProjectProgress(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { statusCommand } = await import('../commands/status.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(statusCommand);
  await program.parseAsync(['node', 'gitpm', 'status', ...args]);
}

function makeProgress(overrides: Record<string, unknown> = {}) {
  return {
    overall: { total: 10, done: 4, progress: 0.4 },
    milestones: [
      {
        title: 'v1',
        targetDate: '2026-06-01T00:00:00Z',
        progress: 0.5,
        epics: [
          {
            title: 'Auth',
            total: 4,
            done: 2,
            inProgress: 1,
            blocked: 1,
            progress: 0.5,
          },
        ],
      },
      {
        title: 'v2',
        targetDate: null,
        progress: 0,
        epics: [],
      },
    ],
    orphanEpics: [
      {
        title: 'Misc',
        total: 2,
        done: 1,
        inProgress: 0,
        blocked: 0,
        progress: 0.5,
      },
    ],
    ...overrides,
  };
}

// --- Tests ---

describe('gitpm status', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    mockParseTree.mockResolvedValue({ ok: true, value: {} });
    mockResolveRefs.mockReturnValue({ ok: true, value: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('outputs JSON when --json is set', async () => {
    const progress = makeProgress();
    mockComputeProjectProgress.mockReturnValue(progress);

    await run('--json', '--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    const parsed = JSON.parse(logOutput);
    expect(parsed.overall.total).toBe(10);
  });

  it('prints message when no stories exist', async () => {
    mockComputeProjectProgress.mockReturnValue({
      overall: { total: 0, done: 0, progress: 0 },
      milestones: [],
      orphanEpics: [],
    });

    await run('--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('No stories found');
  });

  it('prints project progress with milestones, epics, and orphans', async () => {
    mockComputeProjectProgress.mockReturnValue(makeProgress());

    await run('--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Project Status');
    expect(logOutput).toContain('40%');
    expect(logOutput).toContain('4/10 stories');
    expect(logOutput).toContain('v1');
    expect(logOutput).toContain('due 2026-06-01');
    expect(logOutput).toContain('Auth');
    expect(logOutput).toContain('2/4 done');
    expect(logOutput).toContain('1 active');
    expect(logOutput).toContain('1 blocked');
    expect(logOutput).toContain('v2');
    expect(logOutput).toContain('(no epics linked)');
    expect(logOutput).toContain('Unlinked Epics');
    expect(logOutput).toContain('Misc');
  });

  it('omits "Unlinked Epics" when no orphan epics', async () => {
    mockComputeProjectProgress.mockReturnValue(
      makeProgress({ orphanEpics: [] }),
    );

    await run('--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).not.toContain('Unlinked Epics');
  });
});
