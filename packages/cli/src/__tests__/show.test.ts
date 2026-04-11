import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockParseTree = vi.fn();
const mockResolveRefs = vi.fn();

vi.mock('@gitpm/core', () => ({
  parseTree: (...args: unknown[]) => mockParseTree(...args),
  resolveRefs: (...args: unknown[]) => mockResolveRefs(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let _errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { showCommand } = await import('../commands/show.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(showCommand);
  await program.parseAsync(['node', 'gitpm', 'show', ...args]);
}

function makeTree() {
  return {
    stories: [
      {
        type: 'story',
        id: 'st_1',
        title: 'Test Story',
        status: 'todo',
        priority: 'high',
        labels: ['frontend'],
        body: '## Description\nTest body',
        filePath: '/tmp/.meta/stories/test-story.md',
      },
    ],
    epics: [
      {
        type: 'epic',
        id: 'ep_1',
        title: 'Test Epic',
        status: 'in_progress',
        priority: 'high',
        labels: [],
        body: '',
        filePath: '/tmp/.meta/epics/test-epic/epic.md',
      },
    ],
    milestones: [],
    roadmaps: [],
    prds: [],
    errors: [],
  };
}

function makeResolvedTree() {
  return {
    stories: [
      {
        type: 'story',
        id: 'st_1',
        title: 'Test Story',
        status: 'todo',
        priority: 'high',
        labels: ['frontend'],
        body: '## Description\nTest body',
        filePath: '/tmp/.meta/stories/test-story.md',
      },
    ],
    epics: [
      {
        type: 'epic',
        id: 'ep_1',
        title: 'Test Epic',
        status: 'in_progress',
        priority: 'high',
        labels: [],
        body: '',
        filePath: '/tmp/.meta/epics/test-epic/epic.md',
        resolvedStories: [
          {
            type: 'story',
            id: 'st_1',
            title: 'Test Story',
            status: 'todo',
            priority: 'high',
          },
        ],
      },
    ],
    milestones: [
      {
        type: 'milestone',
        id: 'ms_1',
        title: 'v1.0',
        status: 'in_progress',
        body: '',
        filePath: '/tmp/.meta/roadmap/milestones/v1.md',
        resolvedEpics: [],
      },
    ],
    roadmaps: [],
    prds: [],
    errors: [],
  };
}

// --- Tests ---

describe('gitpm show', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    _errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a single entity by ID', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockResolveRefs.mockReturnValue({ ok: true, value: makeResolvedTree() });

    await run('st_1', '--meta-dir', '/tmp');

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Test Story');
  });

  it('shows an epic with its stories', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockResolveRefs.mockReturnValue({ ok: true, value: makeResolvedTree() });

    await run('--epic', 'ep_1', '--meta-dir', '/tmp');

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Test Epic');
    expect(output).toContain('Stories (1)');
    expect(output).toContain('Test Story');
  });

  it('shows an epic by slug', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockResolveRefs.mockReturnValue({ ok: true, value: makeResolvedTree() });

    await run('--epic', 'test-epic', '--meta-dir', '/tmp');

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Test Epic');
  });

  it('outputs JSON when --format json is used with --epic', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockResolveRefs.mockReturnValue({ ok: true, value: makeResolvedTree() });

    await run('--epic', 'ep_1', '--format', 'json', '--meta-dir', '/tmp');

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.epic.id).toBe('ep_1');
    expect(parsed.stories).toHaveLength(1);
  });

  it('exits with code 1 when entity not found', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockResolveRefs.mockReturnValue({ ok: true, value: makeResolvedTree() });

    await expect(run('nonexistent_id', '--meta-dir', '/tmp')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when epic not found', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockResolveRefs.mockReturnValue({ ok: true, value: makeResolvedTree() });

    await expect(
      run('--epic', 'missing', '--meta-dir', '/tmp'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when no target specified', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockResolveRefs.mockReturnValue({ ok: true, value: makeResolvedTree() });

    await expect(run('--meta-dir', '/tmp')).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when parseTree fails', async () => {
    mockParseTree.mockResolvedValue({
      ok: false,
      error: { message: 'cannot read' },
    });

    await expect(run('st_1', '--meta-dir', '/tmp')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
