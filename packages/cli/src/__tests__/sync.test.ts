import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockLoadGitHubConfig = vi.fn();
const mockSyncWithGitHub = vi.fn();
const mockLoadGitLabConfig = vi.fn();
const mockSyncWithGitLab = vi.fn();
const mockResolveToken = vi.fn();
const mockConfirm = vi.fn();
const mockPromptConflictResolution = vi.fn();

vi.mock('@gitpm/sync-github', () => ({
  loadConfig: (...args: unknown[]) => mockLoadGitHubConfig(...args),
  syncWithGitHub: (...args: unknown[]) => mockSyncWithGitHub(...args),
}));

vi.mock('@gitpm/sync-gitlab', () => ({
  loadConfig: (...args: unknown[]) => mockLoadGitLabConfig(...args),
  syncWithGitLab: (...args: unknown[]) => mockSyncWithGitLab(...args),
}));

vi.mock('../utils/auth.js', () => ({
  resolveToken: (...args: unknown[]) => mockResolveToken(...args),
}));

vi.mock('../utils/conflict-ui.js', () => ({
  promptConflictResolution: (...args: unknown[]) =>
    mockPromptConflictResolution(...args),
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
    mockLoadGitHubConfig.mockResolvedValue({
      ok: true,
      value: { repo: 'owner/repo' },
    });
    mockLoadGitLabConfig.mockResolvedValue({
      ok: false,
      error: { message: 'not found' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints summary in dry-run mode', async () => {
    mockSyncWithGitHub.mockResolvedValue({ ok: true, value: syncResult });

    await run('--dry-run', '--meta-dir', '/tmp/meta');

    expect(mockSyncWithGitHub).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Sync Complete');
  });

  it('syncs when user confirms', async () => {
    mockSyncWithGitHub.mockResolvedValue({ ok: true, value: syncResult });
    mockConfirm.mockResolvedValue(true);

    await run('--meta-dir', '/tmp/meta');

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockSyncWithGitHub).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('cancels sync when user declines', async () => {
    mockConfirm.mockResolvedValue(false);

    await run('--meta-dir', '/tmp/meta');

    expect(mockSyncWithGitHub).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Sync cancelled');
  });

  it('skips confirmation with --yes', async () => {
    mockSyncWithGitHub.mockResolvedValue({ ok: true, value: syncResult });

    await run('--yes', '--meta-dir', '/tmp/meta');

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockSyncWithGitHub).toHaveBeenCalled();
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
    mockSyncWithGitHub.mockResolvedValue({
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
    mockSyncWithGitHub.mockResolvedValue({ ok: true, value: syncResult });
    mockConfirm.mockResolvedValue(true);

    await run('--strategy', 'local-wins', '--meta-dir', '/tmp/meta');

    expect(mockPromptConflictResolution).not.toHaveBeenCalled();
    expect(mockSyncWithGitHub).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: 'local-wins' }),
    );
  });

  it('does not prompt for conflicts with remote-wins', async () => {
    mockSyncWithGitHub.mockResolvedValue({ ok: true, value: syncResult });
    mockConfirm.mockResolvedValue(true);

    await run('--strategy', 'remote-wins', '--meta-dir', '/tmp/meta');

    expect(mockPromptConflictResolution).not.toHaveBeenCalled();
    expect(mockSyncWithGitHub).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: 'remote-wins' }),
    );
  });

  it('exits with code 1 when sync fails', async () => {
    mockSyncWithGitHub.mockResolvedValue({
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
    mockLoadGitHubConfig.mockResolvedValue({
      ok: false,
      error: { message: 'not found' },
    });
    mockLoadGitLabConfig.mockResolvedValue({
      ok: false,
      error: { message: 'not found' },
    });

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('No sync config found');
  });

  it('syncs with GitLab in dry-run mode', async () => {
    mockLoadGitHubConfig.mockResolvedValue({
      ok: false,
      error: { message: 'not found' },
    });
    mockLoadGitLabConfig.mockResolvedValue({
      ok: true,
      value: {
        project: 'group/proj',
        project_id: 42,
        base_url: 'https://gitlab.com',
      },
    });
    mockSyncWithGitLab.mockResolvedValue({ ok: true, value: syncResult });

    await run('--dry-run', '--token', 'gl-tok', '--meta-dir', '/tmp/meta');

    expect(mockSyncWithGitLab).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true, token: 'gl-tok' }),
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits with code 1 when GitLab token is missing', async () => {
    const originalEnv = process.env.GITLAB_TOKEN;
    // biome-ignore lint/performance/noDelete: must remove env var, not set to "undefined" string
    delete process.env.GITLAB_TOKEN;

    mockLoadGitHubConfig.mockResolvedValue({
      ok: false,
      error: { message: 'not found' },
    });
    mockLoadGitLabConfig.mockResolvedValue({
      ok: true,
      value: {
        project: 'group/proj',
        project_id: 42,
        base_url: 'https://gitlab.com',
      },
    });

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    process.env.GITLAB_TOKEN = originalEnv;
  });
});
