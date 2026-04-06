import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockImportFromGitHub = vi.fn();
const mockImportFromGitLab = vi.fn();
const mockResolveToken = vi.fn();

vi.mock('@gitpm/sync-github', () => ({
  importFromGitHub: (...args: unknown[]) => mockImportFromGitHub(...args),
}));

vi.mock('@gitpm/sync-gitlab', () => ({
  importFromGitLab: (...args: unknown[]) => mockImportFromGitLab(...args),
}));

vi.mock('../utils/auth.js', () => ({
  resolveToken: (...args: unknown[]) => mockResolveToken(...args),
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
  const { importCommand } = await import('../commands/import.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(importCommand);
  await program.parseAsync(['node', 'gitpm', 'import', ...args]);
}

const importSummary = {
  milestones: 2,
  epics: 3,
  stories: 5,
  totalFiles: 10,
};

// --- Tests ---

describe('gitpm import', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    mockResolveToken.mockResolvedValue('mock-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- GitHub ---

  it('imports from GitHub successfully', async () => {
    mockImportFromGitHub.mockResolvedValue({ ok: true, value: importSummary });

    await run('--repo', 'owner/repo', '--meta-dir', '/tmp/meta');

    expect(mockImportFromGitHub).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'mock-token',
        repo: 'owner/repo',
        metaDir: '/tmp/meta',
      }),
    );
    expect(exitSpy).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Milestones: 2');
    expect(allOutput).toContain('Epics:      3');
    expect(allOutput).toContain('Stories:    5');
  });

  it('exits with code 1 when --repo is missing', async () => {
    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('--repo is required');
  });

  it('exits with code 1 when --repo format is invalid', async () => {
    await expect(
      run('--repo', 'badformat', '--meta-dir', '/tmp/meta'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('passes --link-strategy to importFromGitHub', async () => {
    mockImportFromGitHub.mockResolvedValue({ ok: true, value: importSummary });

    await run(
      '--repo',
      'owner/repo',
      '--link-strategy',
      'labels',
      '--meta-dir',
      '/tmp/meta',
    );

    expect(mockImportFromGitHub).toHaveBeenCalledWith(
      expect.objectContaining({ linkStrategy: 'labels' }),
    );
  });

  it('exits with code 1 for invalid link strategy', async () => {
    await expect(
      run(
        '--repo',
        'owner/repo',
        '--link-strategy',
        'invalid-strat',
        '--meta-dir',
        '/tmp/meta',
      ),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('Invalid link strategy');
  });

  it('exits with code 1 when import fails', async () => {
    mockImportFromGitHub.mockResolvedValue({
      ok: false,
      error: { message: 'API rate limit exceeded' },
    });

    await expect(
      run('--repo', 'owner/repo', '--meta-dir', '/tmp/meta'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('API rate limit exceeded');
  });

  it('exits with code 1 when token resolution fails', async () => {
    mockResolveToken.mockRejectedValue(new Error('No GitHub token found'));

    await expect(
      run('--repo', 'owner/repo', '--meta-dir', '/tmp/meta'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('No GitHub token found');
  });

  // --- GitLab ---

  it('imports from GitLab successfully', async () => {
    mockImportFromGitLab.mockResolvedValue({ ok: true, value: importSummary });

    await run(
      '--source',
      'gitlab',
      '--project',
      'group/proj',
      '--token',
      'gl-tok',
      '--meta-dir',
      '/tmp/meta',
    );

    expect(mockImportFromGitLab).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'gl-tok', project: 'group/proj' }),
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits with code 1 when GitLab project is missing', async () => {
    await expect(
      run('--source', 'gitlab', '--token', 'gl-tok', '--meta-dir', '/tmp/meta'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when GitLab token is missing', async () => {
    const originalEnv = process.env.GITLAB_TOKEN;
    // biome-ignore lint/performance/noDelete: must remove env var, not set to "undefined" string
    delete process.env.GITLAB_TOKEN;

    await expect(
      run(
        '--source',
        'gitlab',
        '--project',
        'group/proj',
        '--meta-dir',
        '/tmp/meta',
      ),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);

    process.env.GITLAB_TOKEN = originalEnv;
  });

  it('exits with code 1 for unknown source', async () => {
    await expect(
      run('--source', 'bitbucket', '--meta-dir', '/tmp/meta'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('Unknown source');
  });
});
