import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockLoadGitHubConfig = vi.fn();
const mockExportToGitHub = vi.fn();
const mockLoadGitLabConfig = vi.fn();
const mockExportToGitLab = vi.fn();
const mockResolveToken = vi.fn();
const mockConfirm = vi.fn();

vi.mock('@gitpm/sync-github', () => ({
  loadConfig: (...args: unknown[]) => mockLoadGitHubConfig(...args),
  exportToGitHub: (...args: unknown[]) => mockExportToGitHub(...args),
}));

vi.mock('@gitpm/sync-gitlab', () => ({
  loadConfig: (...args: unknown[]) => mockLoadGitLabConfig(...args),
  exportToGitLab: (...args: unknown[]) => mockExportToGitLab(...args),
}));

vi.mock('../utils/auth.js', () => ({
  resolveToken: (...args: unknown[]) => mockResolveToken(...args),
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
  const { pushCommand } = await import('../commands/push.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(pushCommand);
  await program.parseAsync(['node', 'gitpm', 'push', ...args]);
}

const exportResult = {
  created: { milestones: 1, issues: 2 },
  updated: { milestones: 0, issues: 1 },
  totalChanges: 4,
};

const noChangesResult = {
  created: { milestones: 0, issues: 0 },
  updated: { milestones: 0, issues: 0 },
  totalChanges: 0,
};

// --- Tests ---

describe('gitpm push', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    mockResolveToken.mockResolvedValue('mock-token');
    // Default: GitHub config found, GitLab not
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

  it('prints preview in dry-run mode', async () => {
    mockExportToGitHub.mockResolvedValue({ ok: true, value: exportResult });

    await run('--dry-run', '--meta-dir', '/tmp/meta');

    expect(mockExportToGitHub).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('New issues:     2');
  });

  it('pushes when user confirms', async () => {
    mockExportToGitHub
      .mockResolvedValueOnce({ ok: true, value: exportResult }) // preview
      .mockResolvedValueOnce({ ok: true, value: exportResult }); // actual push
    mockConfirm.mockResolvedValue(true);

    await run('--meta-dir', '/tmp/meta');

    expect(mockExportToGitHub).toHaveBeenCalledTimes(2);
    expect(mockConfirm).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('cancels push when user declines', async () => {
    mockExportToGitHub.mockResolvedValue({ ok: true, value: exportResult });
    mockConfirm.mockResolvedValue(false);

    await run('--meta-dir', '/tmp/meta');

    // Only called once for preview, not for actual push
    expect(mockExportToGitHub).toHaveBeenCalledTimes(1);
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Push cancelled');
  });

  it('skips confirmation with --yes', async () => {
    mockExportToGitHub
      .mockResolvedValueOnce({ ok: true, value: exportResult })
      .mockResolvedValueOnce({ ok: true, value: exportResult });

    await run('--yes', '--meta-dir', '/tmp/meta');

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockExportToGitHub).toHaveBeenCalledTimes(2);
  });

  it('prints nothing-to-push when totalChanges is 0', async () => {
    mockExportToGitHub.mockResolvedValue({ ok: true, value: noChangesResult });

    await run('--meta-dir', '/tmp/meta');

    expect(mockConfirm).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Nothing to push');
  });

  it('exits with code 1 when push fails', async () => {
    mockExportToGitHub
      .mockResolvedValueOnce({ ok: true, value: exportResult }) // preview ok
      .mockResolvedValueOnce({ ok: false, error: { message: 'push error' } });
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

  it('exits with code 1 when token resolution fails', async () => {
    mockResolveToken.mockRejectedValue(new Error('No GitHub token found'));

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('pushes to GitLab when GitLab config is found', async () => {
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
    mockExportToGitLab.mockResolvedValue({ ok: true, value: exportResult });

    await run('--dry-run', '--token', 'gl-tok', '--meta-dir', '/tmp/meta');

    expect(mockExportToGitLab).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'gl-tok',
        project: 'group/proj',
        dryRun: true,
      }),
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
