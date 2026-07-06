/**
 * Unit tests for the CLI entry point (`packages/cli/src/index.ts`), which
 * wires up `commander` and calls `program.parse()` at module load time.
 * Each test re-imports the module (via `vi.resetModules()`) with a fresh
 * `process.argv` so the top-level `parse()` call runs against the arguments
 * under test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let exitSpy: ReturnType<typeof vi.spyOn>;
let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
let stderrWriteSpy: ReturnType<typeof vi.spyOn>;
let originalArgv: string[];

async function runIndex(...args: string[]): Promise<void> {
  process.argv = ['node', 'gitpm', ...args];
  await import('../index.js');
}

describe('gitpm CLI entry point (index.ts)', () => {
  beforeEach(() => {
    vi.resetModules();
    originalArgv = process.argv;
    stdoutWriteSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrWriteSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('prints the package version and exits 0 for --version', async () => {
    await expect(runIndex('--version')).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(0);

    const written = stdoutWriteSpy.mock.calls.map((c) => String(c[0])).join('');
    // Matches the version field read from packages/cli/package.json.
    expect(written).toMatch(/\d+\.\d+\.\d+/);
  });

  it('registers every documented subcommand', async () => {
    // --help does not exit non-zero; commander prints help and exits 0.
    await expect(runIndex('--help')).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(0);

    const written = stdoutWriteSpy.mock.calls.map((c) => String(c[0])).join('');
    for (const name of [
      'init',
      'validate',
      'import',
      'push',
      'pull',
      'sync',
      'status',
      'quality',
    ]) {
      expect(written).toContain(name);
    }
  });

  it('exits with an error for an unknown command', async () => {
    await expect(runIndex('this-command-does-not-exist')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = stderrWriteSpy.mock.calls
      .map((c) => String(c[0]))
      .join('');
    expect(errOutput.toLowerCase()).toContain('unknown command');
  });
});
