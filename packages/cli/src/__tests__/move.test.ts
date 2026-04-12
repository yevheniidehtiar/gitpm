import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockMoveStory = vi.fn();

vi.mock('@gitpm/core', () => ({
  moveStory: (...args: unknown[]) => mockMoveStory(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let _errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { moveCommand } = await import('../commands/move.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(moveCommand);
  await program.parseAsync(['node', 'gitpm', 'move', ...args]);
}

// --- Tests ---

describe('gitpm move', () => {
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

  it('moves a story to an epic', async () => {
    mockMoveStory.mockResolvedValue({
      ok: true,
      value: {
        oldPath: '/tmp/.meta/stories/story.md',
        newPath: '/tmp/.meta/epics/target/stories/story.md',
      },
    });

    await run(
      '/tmp/.meta/stories/story.md',
      '--to-epic',
      'target-epic',
      '--meta-dir',
      '/tmp',
    );

    expect(mockMoveStory).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { toEpic: 'target-epic', toOrphan: undefined },
    );

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Moved');
  });

  it('moves a story to orphan', async () => {
    mockMoveStory.mockResolvedValue({
      ok: true,
      value: {
        oldPath: '/tmp/.meta/epics/old/stories/story.md',
        newPath: '/tmp/.meta/stories/story.md',
      },
    });

    await run(
      '/tmp/.meta/epics/old/stories/story.md',
      '--to-orphan',
      '--meta-dir',
      '/tmp',
    );

    expect(mockMoveStory).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { toEpic: undefined, toOrphan: true },
    );
  });

  it('exits with code 1 when neither --to-epic nor --to-orphan is given', async () => {
    await expect(
      run('/tmp/.meta/stories/story.md', '--meta-dir', '/tmp'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when moveStory fails', async () => {
    mockMoveStory.mockResolvedValue({
      ok: false,
      error: { message: 'Epic not found' },
    });

    await expect(
      run(
        '/tmp/.meta/stories/story.md',
        '--to-epic',
        'nonexistent',
        '--meta-dir',
        '/tmp',
      ),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints success with old and new paths', async () => {
    mockMoveStory.mockResolvedValue({
      ok: true,
      value: {
        oldPath: '/tmp/.meta/stories/s.md',
        newPath: '/tmp/.meta/epics/e/stories/s.md',
      },
    });

    await run(
      '/tmp/.meta/stories/s.md',
      '--to-epic',
      'e',
      '--meta-dir',
      '/tmp',
    );

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Moved');
    expect(output).toContain('→');
  });
});
