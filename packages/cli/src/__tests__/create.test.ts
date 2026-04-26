import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockParseTree = vi.fn();
const mockCreateStory = vi.fn();
const mockCreateEpic = vi.fn();
const mockCreateMilestone = vi.fn();

vi.mock('@gitpm/core', () => ({
  parseTree: (...args: unknown[]) => mockParseTree(...args),
  createStory: (...args: unknown[]) => mockCreateStory(...args),
  createEpic: (...args: unknown[]) => mockCreateEpic(...args),
  createMilestone: (...args: unknown[]) => mockCreateMilestone(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let _errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { createCommand } = await import('../commands/create.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(createCommand);
  await program.parseAsync(['node', 'gitpm', 'create', ...args]);
}

// --- Tests ---

describe('gitpm create story', () => {
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

  it('creates a story with required options', async () => {
    mockCreateStory.mockResolvedValue({
      ok: true,
      value: { filePath: '/tmp/.meta/stories/test.md', id: 'abc123' },
    });

    await run('story', '--title', 'My test story', '--meta-dir', '/tmp');

    expect(mockCreateStory).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        title: 'My test story',
        priority: 'medium',
        status: 'backlog',
      }),
    );
  });

  it('passes all options to createStory', async () => {
    mockCreateStory.mockResolvedValue({
      ok: true,
      value: { filePath: '/tmp/.meta/stories/test.md', id: 'abc123' },
    });

    await run(
      'story',
      '--title',
      'Full story',
      '--priority',
      'high',
      '--status',
      'todo',
      '--labels',
      'frontend,responsive',
      '--assignee',
      'alice',
      '--meta-dir',
      '/tmp',
    );

    expect(mockCreateStory).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        title: 'Full story',
        priority: 'high',
        status: 'todo',
        labels: ['frontend', 'responsive'],
        assignee: 'alice',
      }),
    );
  });

  it('looks up epic by ID when --epic is provided', async () => {
    mockParseTree.mockResolvedValue({
      ok: true,
      value: {
        epics: [
          {
            id: 'ep_123',
            filePath: '/tmp/.meta/epics/my-epic/epic.md',
          },
        ],
        stories: [],
        milestones: [],
        roadmaps: [],
        prds: [],
        sprints: [],
        errors: [],
      },
    });
    mockCreateStory.mockResolvedValue({
      ok: true,
      value: {
        filePath: '/tmp/.meta/epics/my-epic/stories/test.md',
        id: 'abc123',
      },
    });

    await run(
      'story',
      '--title',
      'Epic story',
      '--epic',
      'ep_123',
      '--meta-dir',
      '/tmp',
    );

    expect(mockCreateStory).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        epicId: 'ep_123',
        epicSlug: 'my-epic',
      }),
    );
  });

  it('exits with code 1 when createStory fails', async () => {
    mockCreateStory.mockResolvedValue({
      ok: false,
      error: { message: 'write failed' },
    });

    await expect(
      run('story', '--title', 'Fail story', '--meta-dir', '/tmp'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints success with ID and path', async () => {
    mockCreateStory.mockResolvedValue({
      ok: true,
      value: { filePath: '/tmp/.meta/stories/test.md', id: 'xyz789' },
    });

    await run('story', '--title', 'Success story', '--meta-dir', '/tmp');

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Created story');
    expect(output).toContain('xyz789');
  });
});

describe('gitpm create epic', () => {
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

  it('creates an epic with required options', async () => {
    mockCreateEpic.mockResolvedValue({
      ok: true,
      value: { filePath: '/tmp/.meta/epics/responsive/epic.md', id: 'ep_001' },
    });

    await run('epic', '--title', 'Responsive Design', '--meta-dir', '/tmp');

    expect(mockCreateEpic).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: 'Responsive Design' }),
    );
    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Created epic');
  });

  it('passes milestone option', async () => {
    mockCreateEpic.mockResolvedValue({
      ok: true,
      value: { filePath: '/tmp/.meta/epics/test/epic.md', id: 'ep_002' },
    });

    await run(
      'epic',
      '--title',
      'Test',
      '--milestone',
      'ms_abc',
      '--meta-dir',
      '/tmp',
    );

    expect(mockCreateEpic).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ milestoneId: 'ms_abc' }),
    );
  });

  it('exits 1 when createEpic fails', async () => {
    mockCreateEpic.mockResolvedValue({
      ok: false,
      error: { message: 'epic error' },
    });

    await expect(
      run('epic', '--title', 'Broken', '--meta-dir', '/tmp'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('parses labels for epic', async () => {
    mockCreateEpic.mockResolvedValue({
      ok: true,
      value: { filePath: '/tmp/.meta/epics/test/epic.md', id: 'ep_003' },
    });

    await run(
      'epic',
      '--title',
      'Labeled',
      '--labels',
      'auth, ui',
      '--meta-dir',
      '/tmp',
    );

    expect(mockCreateEpic).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ labels: ['auth', 'ui'] }),
    );
  });
});

describe('gitpm create milestone', () => {
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

  it('creates a milestone with required options', async () => {
    mockCreateMilestone.mockResolvedValue({
      ok: true,
      value: { filePath: '/tmp/.meta/roadmap/milestones/v2.md', id: 'ms_001' },
    });

    await run('milestone', '--title', 'v2.0 Beta', '--meta-dir', '/tmp');

    expect(mockCreateMilestone).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: 'v2.0 Beta' }),
    );
    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Created milestone');
  });

  it('passes target-date option', async () => {
    mockCreateMilestone.mockResolvedValue({
      ok: true,
      value: { filePath: '/tmp/.meta/roadmap/milestones/v2.md', id: 'ms_002' },
    });

    await run(
      'milestone',
      '--title',
      'v2.0',
      '--target-date',
      '2026-06-01',
      '--meta-dir',
      '/tmp',
    );

    expect(mockCreateMilestone).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ targetDate: '2026-06-01' }),
    );
  });

  it('exits 1 when createMilestone fails', async () => {
    mockCreateMilestone.mockResolvedValue({
      ok: false,
      error: { message: 'milestone error' },
    });

    await expect(
      run('milestone', '--title', 'Bad', '--meta-dir', '/tmp'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('gitpm create story — epic lookup', () => {
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

  it('exits 1 when parseTree fails during epic lookup', async () => {
    mockParseTree.mockResolvedValue({
      ok: false,
      error: { message: 'parse tree error' },
    });

    await expect(
      run('story', '--title', 'X', '--epic', 'ep_x', '--meta-dir', '/tmp'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('finds epic by slug when ID does not match', async () => {
    mockParseTree.mockResolvedValue({
      ok: true,
      value: {
        epics: [
          {
            id: 'ep_abc',
            filePath: '/tmp/.meta/epics/auth-flow/epic.md',
          },
        ],
        stories: [],
        milestones: [],
        roadmaps: [],
        prds: [],
        sprints: [],
        errors: [],
      },
    });
    mockCreateStory.mockResolvedValue({
      ok: true,
      value: {
        filePath: '/tmp/.meta/epics/auth-flow/stories/x.md',
        id: 'st_1',
      },
    });

    await run(
      'story',
      '--title',
      'X',
      '--epic',
      'auth-flow',
      '--meta-dir',
      '/tmp',
    );

    expect(mockCreateStory).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        epicId: 'ep_abc',
        epicSlug: 'auth-flow',
      }),
    );
  });

  it('exits 1 when epic cannot be resolved by ID or slug', async () => {
    mockParseTree.mockResolvedValue({
      ok: true,
      value: {
        epics: [],
        stories: [],
        milestones: [],
        roadmaps: [],
        prds: [],
        sprints: [],
        errors: [],
      },
    });

    await expect(
      run('story', '--title', 'X', '--epic', 'missing', '--meta-dir', '/tmp'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
