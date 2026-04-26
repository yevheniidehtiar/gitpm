import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockCreateSprint = vi.fn();
const mockParseTree = vi.fn();
const mockResolveRefs = vi.fn();

vi.mock('@gitpm/core', () => ({
  createSprint: (...args: unknown[]) => mockCreateSprint(...args),
  parseTree: (...args: unknown[]) => mockParseTree(...args),
  resolveRefs: (...args: unknown[]) => mockResolveRefs(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { sprintCommand } = await import('../commands/sprint.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(sprintCommand);
  await program.parseAsync(['node', 'gitpm', 'sprint', ...args]);
}

function sprintRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sp_1',
    type: 'sprint',
    title: 'Sprint 1',
    status: 'active',
    start_date: '2026-04-01',
    end_date: '2026-04-14',
    capacity: 20,
    resolvedStories: [
      { id: 's1', title: 'Story 1', status: 'done' },
      { id: 's2', title: 'Story 2', status: 'in_progress' },
      { id: 's3', title: 'Story 3', status: 'backlog' },
    ],
    ...overrides,
  };
}

// --- Tests ---

describe('gitpm sprint create', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a sprint', async () => {
    mockCreateSprint.mockResolvedValue({
      ok: true,
      value: { filePath: '/tmp/.meta/sprints/sp1.md', id: 'sp_1' },
    });

    await run(
      'create',
      '--title',
      'Sprint 1',
      '--start',
      '2026-04-01',
      '--end',
      '2026-04-14',
      '--capacity',
      '20',
      '--meta-dir',
      '/tmp/m',
    );

    expect(mockCreateSprint).toHaveBeenCalledWith(
      '/tmp/m',
      expect.objectContaining({
        title: 'Sprint 1',
        startDate: '2026-04-01',
        endDate: '2026-04-14',
        capacity: 20,
      }),
    );
    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Created sprint');
  });

  it('exits 1 when createSprint fails', async () => {
    mockCreateSprint.mockResolvedValue({
      ok: false,
      error: { message: 'already exists' },
    });

    await expect(
      run(
        'create',
        '--title',
        'Sprint',
        '--start',
        '2026-04-01',
        '--end',
        '2026-04-14',
        '--meta-dir',
        '/tmp/m',
      ),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('gitpm sprint list', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    mockParseTree.mockResolvedValue({ ok: true, value: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits 1 when parseTree fails', async () => {
    mockParseTree.mockResolvedValue({
      ok: false,
      error: { message: 'parse err' },
    });
    await expect(run('list', '--meta-dir', '/tmp/m')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when resolveRefs fails', async () => {
    mockResolveRefs.mockReturnValue({
      ok: false,
      error: { message: 'resolve err' },
    });
    await expect(run('list', '--meta-dir', '/tmp/m')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints message when no sprints exist', async () => {
    mockResolveRefs.mockReturnValue({
      ok: true,
      value: { sprints: [] },
    });

    await run('list', '--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('No sprints found');
  });

  it('prints sprint list with progress', async () => {
    mockResolveRefs.mockReturnValue({
      ok: true,
      value: { sprints: [sprintRecord()] },
    });

    await run('list', '--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Sprints');
    expect(logOutput).toContain('Sprint 1');
    expect(logOutput).toContain('1/3 stories');
    expect(logOutput).toContain('cap: 20');
  });

  it('prints sprint list without capacity when capacity is undefined', async () => {
    mockResolveRefs.mockReturnValue({
      ok: true,
      value: { sprints: [sprintRecord({ capacity: undefined })] },
    });

    await run('list', '--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Sprint 1');
    expect(logOutput).not.toContain('cap:');
  });

  it('outputs JSON when --json is set', async () => {
    mockResolveRefs.mockReturnValue({
      ok: true,
      value: { sprints: [sprintRecord()] },
    });

    await run('list', '--json', '--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    const parsed = JSON.parse(logOutput);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: 'sp_1',
      title: 'Sprint 1',
      stories: 3,
      done: 1,
    });
  });

  it('handles sprint with no stories (zero ratio)', async () => {
    mockResolveRefs.mockReturnValue({
      ok: true,
      value: {
        sprints: [sprintRecord({ resolvedStories: [] })],
      },
    });

    await run('list', '--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('0/0 stories');
  });
});

describe('gitpm sprint show', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    mockParseTree.mockResolvedValue({ ok: true, value: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits 1 when parseTree fails', async () => {
    mockParseTree.mockResolvedValue({
      ok: false,
      error: { message: 'parse err' },
    });
    await expect(run('show', 'sp_1', '--meta-dir', '/tmp/m')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when resolveRefs fails', async () => {
    mockResolveRefs.mockReturnValue({
      ok: false,
      error: { message: 'resolve err' },
    });
    await expect(run('show', 'sp_1', '--meta-dir', '/tmp/m')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when sprint is not found', async () => {
    mockResolveRefs.mockReturnValue({
      ok: true,
      value: { sprints: [] },
    });

    await expect(
      run('show', 'missing', '--meta-dir', '/tmp/m'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('Sprint not found');
  });

  it('shows sprint details with stories and capacity', async () => {
    mockResolveRefs.mockReturnValue({
      ok: true,
      value: { sprints: [sprintRecord()] },
    });

    await run('show', 'sp_1', '--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Sprint 1');
    expect(logOutput).toContain('Status:');
    expect(logOutput).toContain('Period:');
    expect(logOutput).toContain('Capacity: 20');
    expect(logOutput).toContain('Progress:');
    expect(logOutput).toContain('Stories:');
    expect(logOutput).toContain('Story 1');
    expect(logOutput).toContain('Story 2');
    expect(logOutput).toContain('Story 3');
  });

  it('shows "No stories assigned" when sprint has no stories', async () => {
    mockResolveRefs.mockReturnValue({
      ok: true,
      value: { sprints: [sprintRecord({ resolvedStories: [] })] },
    });

    await run('show', 'sp_1', '--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('No stories assigned');
  });

  it('omits Capacity row when capacity not set', async () => {
    mockResolveRefs.mockReturnValue({
      ok: true,
      value: {
        sprints: [sprintRecord({ capacity: undefined })],
      },
    });

    await run('show', 'sp_1', '--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).not.toContain('Capacity:');
  });

  it('renders cancelled and in_progress statuses differently', async () => {
    mockResolveRefs.mockReturnValue({
      ok: true,
      value: {
        sprints: [
          sprintRecord({
            resolvedStories: [
              { id: 's1', title: 'Done', status: 'done' },
              { id: 's2', title: 'Cancelled', status: 'cancelled' },
              { id: 's3', title: 'InProgress', status: 'in_progress' },
              { id: 's4', title: 'Other', status: 'backlog' },
            ],
          }),
        ],
      },
    });

    await run('show', 'sp_1', '--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Done');
    expect(logOutput).toContain('Cancelled');
    expect(logOutput).toContain('InProgress');
    expect(logOutput).toContain('Other');
  });
});
