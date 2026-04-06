import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockScaffoldMeta = vi.fn();
const mockInput = vi.fn();

vi.mock('@gitpm/core', () => ({
  scaffoldMeta: (...args: unknown[]) => mockScaffoldMeta(...args),
}));

vi.mock('@inquirer/prompts', () => ({
  input: (...args: unknown[]) => mockInput(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { initCommand } = await import('../commands/init.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(initCommand);
  await program.parseAsync(['node', 'gitpm', 'init', ...args]);
}

// --- Tests ---

describe('gitpm init', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-cli-init-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates .meta structure with project name argument', async () => {
    const metaDir = join(tmpDir, '.meta');
    mockScaffoldMeta.mockResolvedValue({ ok: true, value: undefined });

    // scaffoldMeta is mocked, so collectFiles will read from an empty dir.
    // We need to create at least one file so the readdir doesn't fail.
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(metaDir, { recursive: true });
    await writeFile(join(metaDir, 'roadmap.yaml'), '');

    await run('my-project', '--meta-dir', metaDir);

    expect(mockScaffoldMeta).toHaveBeenCalledWith(metaDir, 'my-project');
    expect(mockInput).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prompts for project name when not provided', async () => {
    const metaDir = join(tmpDir, '.meta');
    mockInput.mockResolvedValue('prompted-name');
    mockScaffoldMeta.mockResolvedValue({ ok: true, value: undefined });

    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(metaDir, { recursive: true });
    await writeFile(join(metaDir, 'roadmap.yaml'), '');

    await run('--meta-dir', metaDir);

    expect(mockInput).toHaveBeenCalled();
    expect(mockScaffoldMeta).toHaveBeenCalledWith(metaDir, 'prompted-name');
  });

  it('exits with code 1 when scaffoldMeta fails', async () => {
    const metaDir = join(tmpDir, '.meta');
    mockScaffoldMeta.mockResolvedValue({
      ok: false,
      error: { message: 'directory already exists' },
    });

    await expect(run('my-project', '--meta-dir', metaDir)).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('directory already exists');
  });

  it('respects --meta-dir option', async () => {
    const customDir = join(tmpDir, 'custom-meta');
    mockScaffoldMeta.mockResolvedValue({ ok: true, value: undefined });

    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(customDir, { recursive: true });
    await writeFile(join(customDir, 'roadmap.yaml'), '');

    await run('test-proj', '--meta-dir', customDir);

    expect(mockScaffoldMeta).toHaveBeenCalledWith(customDir, 'test-proj');
  });
});
