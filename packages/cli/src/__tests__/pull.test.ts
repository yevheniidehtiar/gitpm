import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockAdapterSync = vi.fn();
const mockResolveAdapter = vi.fn();
const mockResolveToken = vi.fn();
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
  const { pullCommand } = await import('../commands/pull.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(pullCommand);
  await program.parseAsync(['node', 'gitpm', 'pull', ...args]);
}

const pullResult = {
  pushed: { milestones: 0, issues: 0 },
  pulled: { milestones: 1, issues: 3 },
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
    export: vi.fn(),
    sync: mockAdapterSync,
  };
  mockResolveAdapter.mockResolvedValue({
    adapter,
    config: { adapters: [], hooks: {} },
  });
  return adapter;
}

// --- Tests ---

describe('gitpm pull', () => {
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

  it('pulls from GitHub successfully with remote-wins', async () => {
    mockAdapterSync.mockResolvedValue({ ok: true, value: pullResult });

    await run('--meta-dir', '/tmp/meta');

    expect(mockAdapterSync).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: 'remote-wins' }),
    );
    expect(exitSpy).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Pull Summary');
    expect(allOutput).toContain('4 changes');
  });

  it('prompts for conflict resolution with ask strategy', async () => {
    const conflicts = [
      {
        entityId: 'e1',
        entityTitle: 'Story 1',
        entityType: 'story',
        field: 'title',
        localValue: 'Local Title',
        remoteValue: 'Remote Title',
      },
    ];
    mockAdapterSync.mockResolvedValue({
      ok: true,
      value: { ...pullResult, conflicts, resolved: 0 },
    });
    mockPromptConflictResolution.mockResolvedValue([
      { entityId: 'e1', field: 'title', pick: 'local' },
    ]);

    await run('--strategy', 'ask', '--meta-dir', '/tmp/meta');

    expect(mockPromptConflictResolution).toHaveBeenCalledWith(conflicts);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('does not prompt for conflicts with local-wins', async () => {
    mockAdapterSync.mockResolvedValue({ ok: true, value: pullResult });

    await run('--strategy', 'local-wins', '--meta-dir', '/tmp/meta');

    expect(mockPromptConflictResolution).not.toHaveBeenCalled();
    expect(mockAdapterSync).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: 'local-wins' }),
    );
  });

  it('exits with code 1 when pull fails', async () => {
    mockAdapterSync.mockResolvedValue({
      ok: false,
      error: { message: 'sync error' },
    });

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('sync error');
  });

  it('exits with code 1 when no sync config found', async () => {
    mockResolveAdapter.mockImplementation(() => {
      process.exit(1);
    });

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('pulls from GitLab when GitLab adapter detects', async () => {
    setupMockAdapter('gitlab', 'GitLab');
    mockAdapterSync.mockResolvedValue({ ok: true, value: pullResult });

    await run('--token', 'gl-tok', '--meta-dir', '/tmp/meta');

    expect(mockAdapterSync).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('runs pre-sync and post-sync hooks', async () => {
    mockAdapterSync.mockResolvedValue({ ok: true, value: pullResult });

    await run('--meta-dir', '/tmp/meta');

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

  it('exits 1 when pre-sync hook fails', async () => {
    mockRunHooks.mockResolvedValueOnce({
      ok: false,
      error: { message: 'hook failed' },
    });

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
