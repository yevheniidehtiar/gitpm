import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockLoadGitHubConfig = vi.fn();
const mockSyncWithGitHub = vi.fn();
const mockLoadGitLabConfig = vi.fn();
const mockSyncWithGitLab = vi.fn();
const mockResolveToken = vi.fn();
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
  pulled: { milestones: 1, issues: 3 },
  conflicts: [],
  resolved: 0,
  skipped: 0,
};

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

  it('pulls from GitHub successfully with remote-wins', async () => {
    mockSyncWithGitHub.mockResolvedValue({ ok: true, value: pullResult });

    await run('--meta-dir', '/tmp/meta');

    expect(mockSyncWithGitHub).toHaveBeenCalledWith(
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
    mockSyncWithGitHub.mockResolvedValue({
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
    mockSyncWithGitHub.mockResolvedValue({ ok: true, value: pullResult });

    await run('--strategy', 'local-wins', '--meta-dir', '/tmp/meta');

    expect(mockPromptConflictResolution).not.toHaveBeenCalled();
    expect(mockSyncWithGitHub).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: 'local-wins' }),
    );
  });

  it('exits with code 1 when pull fails', async () => {
    mockSyncWithGitHub.mockResolvedValue({
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

  it('exits with code 1 when token resolution fails', async () => {
    mockResolveToken.mockRejectedValue(new Error('No GitHub token found'));

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('pulls from GitLab when GitLab config is found', async () => {
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
    mockSyncWithGitLab.mockResolvedValue({ ok: true, value: pullResult });

    await run('--token', 'gl-tok', '--meta-dir', '/tmp/meta');

    expect(mockSyncWithGitLab).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'gl-tok', project: 'group/proj' }),
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits with code 1 when GitLab token is missing', async () => {
    const originalEnv = process.env.GITLAB_TOKEN;
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
