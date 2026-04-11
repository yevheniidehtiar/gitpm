import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockExecSync = vi.fn();
const mockExecFileSync = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
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
    // First call: execFileSync for git add
    mockExecFileSync.mockReturnValueOnce('');
    // Second call: execSync for git diff --cached --quiet (throws = changes exist)
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('changes exist');
    });
    // Third call: execFileSync for git commit
    mockExecFileSync.mockReturnValueOnce('[main abc1234] test commit\n');

    await run('-m', 'test commit', '--meta-dir', '.meta');

    // Verify git add was called via execFileSync
    expect(mockExecFileSync).toHaveBeenNthCalledWith(
      1,
      'git',
      ['add', expect.any(String)],
      expect.anything(),
    );

    // Verify git commit was called via execFileSync with args array (no shell injection)
    expect(mockExecFileSync).toHaveBeenNthCalledWith(
      2,
      'git',
      ['commit', '-m', 'test commit'],
      expect.objectContaining({
        env: expect.objectContaining({ SKIP: 'commitizen' }),
      }),
    );
  });

  it('includes --author when provided', async () => {
    mockExecFileSync.mockReturnValueOnce('');
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('changes');
    });
    mockExecFileSync.mockReturnValueOnce('[main abc1234] msg\n');

    await run(
      '-m',
      'agent commit',
      '--author',
      'Agent <agent@test.com>',
      '--meta-dir',
      '.meta',
    );

    expect(mockExecFileSync).toHaveBeenNthCalledWith(
      2,
      'git',
      ['commit', '-m', 'agent commit', '--author', 'Agent <agent@test.com>'],
      expect.anything(),
    );
  });

  it('exits with code 1 when there are no changes', async () => {
    mockExecFileSync.mockReturnValueOnce(''); // git add
    mockExecSync.mockReturnValueOnce(''); // git diff --cached --quiet (succeeds = no changes)

    await expect(run('-m', 'nothing', '--meta-dir', '.meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('No changes to commit');
  });

  it('exits with code 1 when commit fails', async () => {
    mockExecFileSync
      .mockReturnValueOnce('') // git add
      .mockImplementationOnce(() => {
        const err = new Error('commit failed');
        (err as { stderr?: string }).stderr = 'hook failed';
        throw err;
      }); // git commit fails
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('changes');
    }); // git diff (has changes)

    await expect(run('-m', 'fail', '--meta-dir', '.meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints success with commit hash', async () => {
    mockExecFileSync
      .mockReturnValueOnce('')
      .mockReturnValueOnce('[main a1b2c3d] good commit\n');
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('changes');
    });

    await run('-m', 'good commit', '--meta-dir', '.meta');

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Committed');
    expect(output).toContain('a1b2c3d');
  });

  it('sets SKIP=commitizen in environment', async () => {
    mockExecFileSync
      .mockReturnValueOnce('')
      .mockReturnValueOnce('[main abc] msg\n');
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('changes');
    });

    await run('-m', 'test', '--meta-dir', '.meta');

    // The commit call (2nd execFileSync) should have SKIP env
    const commitCall = mockExecFileSync.mock.calls[1];
    expect(commitCall[2].env.SKIP).toBe('commitizen');
  });

  it('uses execFileSync to prevent shell injection', async () => {
    mockExecFileSync
      .mockReturnValueOnce('')
      .mockReturnValueOnce('[main abc] msg\n');
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('changes');
    });

    const malicious = 'test"; rm -rf /; echo "';
    await run('-m', malicious, '--meta-dir', '.meta');

    // execFileSync receives the message as a separate array element, not interpolated into shell
    expect(mockExecFileSync).toHaveBeenNthCalledWith(
      2,
      'git',
      ['commit', '-m', malicious],
      expect.anything(),
    );
  });
});
