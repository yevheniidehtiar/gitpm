import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockParseTree = vi.fn();

vi.mock('@gitpm/core', () => ({
  parseTree: (...args: unknown[]) => mockParseTree(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { nextCommand } = await import('../commands/next.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(nextCommand);
  await program.parseAsync(['node', 'gitpm', 'next', ...args]);
}

function makeStory(id: string, overrides: Record<string, unknown> = {}) {
  return {
    type: 'story',
    id,
    title: `Story ${id}`,
    status: 'todo',
    priority: 'medium',
    labels: [],
    body: '',
    filePath: `/tmp/.meta/stories/${id}.md`,
    assignee: undefined,
    ...overrides,
  };
}

// --- Tests ---

describe('gitpm next', () => {
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

  it('exits 1 when parseTree fails', async () => {
    mockParseTree.mockResolvedValue({
      ok: false,
      error: { message: 'no tree' },
    });

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('no tree');
  });

  it('prints "no stories" when none are pickable', async () => {
    mockParseTree.mockResolvedValue({
      ok: true,
      value: {
        stories: [makeStory('s1', { status: 'done' })],
        epics: [],
        milestones: [],
        roadmaps: [],
        prds: [],
        sprints: [],
        errors: [],
      },
    });

    await run('--meta-dir', '/tmp/meta');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('No stories ready');
  });

  it('sorts by priority, todo before backlog', async () => {
    mockParseTree.mockResolvedValue({
      ok: true,
      value: {
        stories: [
          makeStory('low', { priority: 'low', status: 'backlog' }),
          makeStory('crit', { priority: 'critical' }),
          makeStory('high-backlog', { priority: 'high', status: 'backlog' }),
          makeStory('high-todo', { priority: 'high', status: 'todo' }),
          makeStory('med', { priority: 'medium' }),
        ],
        epics: [],
        milestones: [],
        roadmaps: [],
        prds: [],
        sprints: [],
        errors: [],
      },
    });

    await run('--count', '2', '--meta-dir', '/tmp/meta');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    // Critical first, then high-todo before high-backlog (within same priority)
    const critIdx = logOutput.indexOf('Story crit');
    const highTodoIdx = logOutput.indexOf('Story high-todo');
    const highBacklogIdx = logOutput.indexOf('Story high-backlog');
    expect(critIdx).toBeGreaterThanOrEqual(0);
    expect(highTodoIdx).toBeGreaterThan(critIdx);
    expect(highBacklogIdx).toBe(-1); // count=2 excludes it
    expect(logOutput).toContain('Next 2 stories');
  });

  it('handles unknown priority via default bullet', async () => {
    mockParseTree.mockResolvedValue({
      ok: true,
      value: {
        stories: [makeStory('s1', { priority: 'weird' })],
        epics: [],
        milestones: [],
        roadmaps: [],
        prds: [],
        sprints: [],
        errors: [],
      },
    });

    await run('--meta-dir', '/tmp/meta');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Story s1');
  });

  it('filters by assignee case-insensitively', async () => {
    mockParseTree.mockResolvedValue({
      ok: true,
      value: {
        stories: [
          makeStory('s1', { assignee: 'Alice' }),
          makeStory('s2', { assignee: 'bob' }),
          makeStory('s3', { assignee: null }),
        ],
        epics: [],
        milestones: [],
        roadmaps: [],
        prds: [],
        sprints: [],
        errors: [],
      },
    });

    await run('--assignee', 'alice', '--meta-dir', '/tmp/meta');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Story s1');
    expect(logOutput).toContain('@Alice');
    expect(logOutput).not.toContain('Story s2');
  });

  it('renders all priority bullets (critical, high, medium, low, default)', async () => {
    mockParseTree.mockResolvedValue({
      ok: true,
      value: {
        stories: [
          makeStory('c', { priority: 'critical' }),
          makeStory('h', { priority: 'high' }),
          makeStory('m', { priority: 'medium' }),
          makeStory('l', { priority: 'low' }),
        ],
        epics: [],
        milestones: [],
        roadmaps: [],
        prds: [],
        sprints: [],
        errors: [],
      },
    });

    await run('--meta-dir', '/tmp/meta');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Story c');
    expect(logOutput).toContain('Story h');
    expect(logOutput).toContain('Story m');
    expect(logOutput).toContain('Story l');
  });

  it('shows "unassigned" for stories without assignee', async () => {
    mockParseTree.mockResolvedValue({
      ok: true,
      value: {
        stories: [makeStory('s1', { assignee: null })],
        epics: [],
        milestones: [],
        roadmaps: [],
        prds: [],
        sprints: [],
        errors: [],
      },
    });

    await run('--meta-dir', '/tmp/meta');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('unassigned');
  });
});
