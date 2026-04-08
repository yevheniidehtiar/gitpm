import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockExecSync = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { commitCommand } = await import('../commands/commit.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(commitCommand);
  await program.parseAsync(['node', 'gitpm', 'commit', ...args]);
}

// --- Tests ---

describe('gitpm commit', () => {
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

  it('stages .meta/ and commits with message', async () => {
    // First call: git add
    // Second call: git diff --cached --quiet (throws to indicate changes exist)
    // Third call: git commit
    mockExecSync
      .mockReturnValueOnce('') // git add
      .mockImplementationOnce(() => {
        throw new Error('changes exist');
      }) // git diff --cached --quiet
      .mockReturnValueOnce('[main abc1234] test commit\n'); // git commit

    await run('-m', 'test commit', '--meta-dir', '.meta');

    // Verify git add was called with .meta dir
    expect(mockExecSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('git add'),
      expect.anything(),
    );

    // Verify git commit was called with the message
    expect(mockExecSync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('test commit'),
      expect.objectContaining({
        env: expect.objectContaining({ SKIP: 'commitizen' }),
      }),
    );
  });

  it('includes --author when provided', async () => {
    mockExecSync
      .mockReturnValueOnce('')
      .mockImplementationOnce(() => {
        throw new Error('changes');
      })
      .mockReturnValueOnce('[main abc1234] msg\n');

    await run(
      '-m',
      'agent commit',
      '--author',
      'Agent <agent@test.com>',
      '--meta-dir',
      '.meta',
    );

    expect(mockExecSync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('--author'),
      expect.anything(),
    );
  });

  it('exits with code 1 when there are no changes', async () => {
    mockExecSync
      .mockReturnValueOnce('') // git add
      .mockReturnValueOnce(''); // git diff --cached --quiet (succeeds = no changes)

    await expect(run('-m', 'nothing', '--meta-dir', '.meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('No changes to commit');
  });

  it('exits with code 1 when commit fails', async () => {
    mockExecSync
      .mockReturnValueOnce('') // git add
      .mockImplementationOnce(() => {
        throw new Error('changes');
      }) // git diff (has changes)
      .mockImplementationOnce(() => {
        const err = new Error('commit failed');
        (err as { stderr?: string }).stderr = 'hook failed';
        throw err;
      }); // git commit fails

    await expect(run('-m', 'fail', '--meta-dir', '.meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints success with commit hash', async () => {
    mockExecSync
      .mockReturnValueOnce('')
      .mockImplementationOnce(() => {
        throw new Error('changes');
      })
      .mockReturnValueOnce('[main a1b2c3d] good commit\n');

    await run('-m', 'good commit', '--meta-dir', '.meta');

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Committed');
    expect(output).toContain('a1b2c3d');
  });

  it('sets SKIP=commitizen in environment', async () => {
    mockExecSync
      .mockReturnValueOnce('')
      .mockImplementationOnce(() => {
        throw new Error('changes');
      })
      .mockReturnValueOnce('[main abc] msg\n');

    await run('-m', 'test', '--meta-dir', '.meta');

    // The commit call (3rd) should have SKIP env
    const commitCall = mockExecSync.mock.calls[2];
    expect(commitCall[1].env.SKIP).toBe('commitizen');
  });
});
