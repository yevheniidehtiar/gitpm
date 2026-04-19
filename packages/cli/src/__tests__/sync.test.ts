import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockAdapterSync = vi.fn();
const mockAdapterExport = vi.fn();
const mockResolveAdapter = vi.fn();
const mockResolveToken = vi.fn();
const mockConfirm = vi.fn();
const mockPromptConflictResolution = vi.fn();
const mockRunHooks = vi.fn();

vi.mock('../utils/adapters.js', () => ({
  resolveAdapter: (...args: unknown[]) => mockResolveAdapter(...args),
}));

vi.mock('../utils/auth.js', () => ({
  resolveToken: (...args: unknown[]) => mockResolveToken(...args),
}));

vi.mock('../utils/conflict-ui.js', () => ({
  promptConflictResolution: (...args: unknown[]) =>
    mockPromptConflictResolution(...args),
}));

vi.mock('@gitpm/core', () => ({
  runHooks: (...args: unknown[]) => mockRunHooks(...args),
}));

vi.mock('@inquirer/prompts', () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  }),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { syncCommand } = await import('../commands/sync.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(syncCommand);
  await program.parseAsync(['node', 'gitpm', 'sync', ...args]);
}

const syncResult = {
  pushed: { milestones: 1, issues: 2 },
  pulled: { milestones: 0, issues: 3 },
  conflicts: [],
  resolved: 0,
  skipped: 0,
};

function setupMockAdapter(name = 'github', displayName = 'GitHub') {
  const adapter = {
    name,
    displayName,
    detect: vi.fn().mockResolvedValue(true),
    import: vi.fn(),
    export: mockAdapterExport,
    sync: mockAdapterSync,
  };
  mockResolveAdapter.mockResolvedValue({
    adapter,
    config: { adapters: [], hooks: {} },
  });
  return adapter;
}

// --- Tests ---

describe('gitpm sync', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    mockResolveToken.mockResolvedValue('mock-token');
    mockRunHooks.mockResolvedValue({ ok: true, value: undefined });
    setupMockAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints summary in dry-run mode', async () => {
    mockAdapterSync.mockResolvedValue({ ok: true, value: syncResult });

    await run('--dry-run', '--meta-dir', '/tmp/meta');

    expect(mockAdapterSync).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Sync Complete');
  });

  it('syncs when user confirms', async () => {
    mockAdapterSync.mockResolvedValue({ ok: true, value: syncResult });
    mockConfirm.mockResolvedValue(true);

    await run('--meta-dir', '/tmp/meta');

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockAdapterSync).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('cancels sync when user declines', async () => {
    mockConfirm.mockResolvedValue(false);

    await run('--meta-dir', '/tmp/meta');

    expect(mockAdapterSync).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Sync cancelled');
  });

  it('skips confirmation with --yes', async () => {
    mockAdapterSync.mockResolvedValue({ ok: true, value: syncResult });

    await run('--yes', '--meta-dir', '/tmp/meta');

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockAdapterSync).toHaveBeenCalled();
  });

  it('prompts for conflict resolution with ask strategy', async () => {
    const conflicts = [
      {
        entityId: 'e1',
        entityTitle: 'Story 1',
        entityType: 'story',
        field: 'status',
        localValue: 'in_progress',
        remoteValue: 'done',
      },
    ];
    mockAdapterSync.mockResolvedValue({
      ok: true,
      value: { ...syncResult, conflicts, resolved: 0 },
    });
    mockConfirm.mockResolvedValue(true);
    mockPromptConflictResolution.mockResolvedValue([
      { entityId: 'e1', field: 'status', pick: 'remote' },
    ]);

    await run('--strategy', 'ask', '--meta-dir', '/tmp/meta');

    expect(mockPromptConflictResolution).toHaveBeenCalledWith(conflicts);
  });

  it('does not prompt for conflicts with local-wins', async () => {
    mockAdapterSync.mockResolvedValue({ ok: true, value: syncResult });
    mockConfirm.mockResolvedValue(true);

    await run('--strategy', 'local-wins', '--meta-dir', '/tmp/meta');

    expect(mockPromptConflictResolution).not.toHaveBeenCalled();
    expect(mockAdapterSync).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: 'local-wins' }),
    );
  });

  it('does not prompt for conflicts with remote-wins', async () => {
    mockAdapterSync.mockResolvedValue({ ok: true, value: syncResult });
    mockConfirm.mockResolvedValue(true);

    await run('--strategy', 'remote-wins', '--meta-dir', '/tmp/meta');

    expect(mockPromptConflictResolution).not.toHaveBeenCalled();
    expect(mockAdapterSync).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: 'remote-wins' }),
    );
  });

  it('exits with code 1 when sync fails', async () => {
    mockAdapterSync.mockResolvedValue({
      ok: false,
      error: { message: 'sync failed' },
    });
    mockConfirm.mockResolvedValue(true);

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when no sync config found', async () => {
    mockResolveAdapter.mockImplementation(() => {
      // resolveAdapter calls process.exit(1) internally, simulate that
      process.exit(1);
    });

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('syncs with GitLab in dry-run mode', async () => {
    setupMockAdapter('gitlab', 'GitLab');
    mockAdapterSync.mockResolvedValue({ ok: true, value: syncResult });

    await run('--dry-run', '--token', 'gl-tok', '--meta-dir', '/tmp/meta');

    expect(mockAdapterSync).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('runs pre-sync and post-sync hooks', async () => {
    mockAdapterSync.mockResolvedValue({ ok: true, value: syncResult });
    mockConfirm.mockResolvedValue(true);

    await run('--yes', '--meta-dir', '/tmp/meta');

    expect(mockRunHooks).toHaveBeenCalledWith(
      expect.anything(),
      'pre-sync',
      expect.objectContaining({ event: 'pre-sync' }),
    );
    expect(mockRunHooks).toHaveBeenCalledWith(
      expect.anything(),
      'post-sync',
      expect.objectContaining({ event: 'post-sync' }),
    );
  });

  it('exits 1 on invalid strategy', async () => {
    await expect(
      run('--strategy', 'xyz', '--meta-dir', '/tmp/meta'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('Invalid strategy');
  });

  it('exits 1 when dry-run sync fails', async () => {
    mockAdapterSync.mockResolvedValue({
      ok: false,
      error: { message: 'dry failed' },
    });

    await expect(run('--dry-run', '--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when pre-sync hook fails', async () => {
    mockRunHooks.mockResolvedValueOnce({
      ok: false,
      error: { message: 'hook failed' },
    });

    await expect(run('--yes', '--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints resumedFromCheckpoint and failedEntities summary', async () => {
    mockAdapterSync.mockResolvedValue({
      ok: true,
      value: {
        ...syncResult,
        resumedFromCheckpoint: true,
        failedEntities: [
          { entityId: 'e1', error: 'boom' },
          { entityId: 'e2', error: 'kaboom' },
        ],
      },
    });
    mockConfirm.mockResolvedValue(true);

    await run('--meta-dir', '/tmp/meta');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Resumed from previous checkpoint');
    expect(logOutput).toContain('Failed');
    expect(logOutput).toContain('e1: boom');
    expect(logOutput).toContain('e2: kaboom');
    expect(logOutput).toContain('checkpoint was saved');
  });
});
