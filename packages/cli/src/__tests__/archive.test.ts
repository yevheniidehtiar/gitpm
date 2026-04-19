import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockArchiveOldEntities = vi.fn();

vi.mock('@gitpm/core', () => ({
  archiveOldEntities: (...args: unknown[]) => mockArchiveOldEntities(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { archiveCommand } = await import('../commands/archive.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(archiveCommand);
  await program.parseAsync(['node', 'gitpm', 'archive', ...args]);
}

// --- Tests ---

describe('gitpm archive', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-cli-archive-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('exits with code 1 when --days is negative', async () => {
    await expect(run('--days', '-1', '--meta-dir', tmpDir)).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('non-negative');
  });

  it('exits with code 1 when --days is not a number', async () => {
    await expect(run('--days', 'abc', '--meta-dir', tmpDir)).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints dry-run warning and "would archive" label when --dry-run', async () => {
    mockArchiveOldEntities.mockResolvedValue({
      ok: true,
      value: {
        archivedFiles: ['.meta/stories/x.md'],
        archivedEntityIds: ['st_1'],
      },
    });

    await run('--dry-run', '--meta-dir', tmpDir);

    expect(mockArchiveOldEntities).toHaveBeenCalledWith(tmpDir, {
      daysOld: 7,
      dryRun: true,
    });
    const warnOutput = warnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(warnOutput).toContain('Dry run');
    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('would archive');
  });

  it('exits with code 1 when archiveOldEntities fails', async () => {
    mockArchiveOldEntities.mockResolvedValue({
      ok: false,
      error: { message: 'cannot archive' },
    });

    await expect(run('--meta-dir', tmpDir)).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('cannot archive');
  });

  it('prints "no entities" message when nothing archived', async () => {
    mockArchiveOldEntities.mockResolvedValue({
      ok: true,
      value: { archivedFiles: [], archivedEntityIds: [] },
    });

    await run('--meta-dir', tmpDir);

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('No done/cancelled entities older than');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('archives files and cleans up sync state', async () => {
    const syncDir = join(tmpDir, 'sync');
    await mkdir(syncDir, { recursive: true });
    const statePath = join(syncDir, 'github-state.json');
    await writeFile(
      statePath,
      JSON.stringify({
        entities: {
          st_1: { number: 1 },
          st_2: { number: 2 },
          st_3: { number: 3 },
        },
      }),
      'utf-8',
    );

    mockArchiveOldEntities.mockResolvedValue({
      ok: true,
      value: {
        archivedFiles: ['.meta/stories/a.md', '.meta/stories/b.md'],
        archivedEntityIds: ['st_1', 'st_2'],
      },
    });

    await run('--days', '30', '--meta-dir', tmpDir);

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('archived');
    expect(logOutput).toContain('removed 2 entries from sync state');
    expect(logOutput).toContain('Archived 2 file(s)');

    // Verify sync state was rewritten
    const raw = await readFile(statePath, 'utf-8');
    const state = JSON.parse(raw);
    expect(state.entities.st_1).toBeUndefined();
    expect(state.entities.st_2).toBeUndefined();
    expect(state.entities.st_3).toEqual({ number: 3 });
  });

  it('archives files but skips sync state cleanup when state file missing', async () => {
    mockArchiveOldEntities.mockResolvedValue({
      ok: true,
      value: {
        archivedFiles: ['.meta/stories/x.md'],
        archivedEntityIds: ['st_1'],
      },
    });

    await run('--meta-dir', tmpDir);

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Archived 1 file(s)');
    // No removed entries message when state file missing
    expect(logOutput).not.toContain('removed');
  });

  it('does not remove anything from sync state when no IDs match', async () => {
    const syncDir = join(tmpDir, 'sync');
    await mkdir(syncDir, { recursive: true });
    const statePath = join(syncDir, 'github-state.json');
    await writeFile(
      statePath,
      JSON.stringify({ entities: { other_id: { number: 1 } } }),
      'utf-8',
    );

    mockArchiveOldEntities.mockResolvedValue({
      ok: true,
      value: {
        archivedFiles: ['.meta/stories/x.md'],
        archivedEntityIds: ['st_1'],
      },
    });

    await run('--meta-dir', tmpDir);

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).not.toContain('removed');
  });

  it('prints dry-run summary when --dry-run with files', async () => {
    mockArchiveOldEntities.mockResolvedValue({
      ok: true,
      value: {
        archivedFiles: ['.meta/stories/x.md', '.meta/stories/y.md'],
        archivedEntityIds: ['st_1', 'st_2'],
      },
    });

    await run('--dry-run', '--meta-dir', tmpDir);

    const warnOutput = warnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(warnOutput).toContain('2 file(s) would be archived (dry run)');
  });
});
