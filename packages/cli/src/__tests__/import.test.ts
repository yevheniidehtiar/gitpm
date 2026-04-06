import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockAdapterImport = vi.fn();
const mockLoadGitpmConfig = vi.fn();
const mockLoadAdapters = vi.fn();
const mockFindAdapterByName = vi.fn();
const mockRunHooks = vi.fn();
const mockResolveToken = vi.fn();

function createMockAdapter(name: string, displayName: string) {
  return {
    name,
    displayName,
    detect: vi.fn().mockResolvedValue(true),
    import: mockAdapterImport,
    export: vi.fn(),
    sync: vi.fn(),
  };
}

vi.mock('@gitpm/core', () => ({
  loadGitpmConfig: (...args: unknown[]) => mockLoadGitpmConfig(...args),
  loadAdapters: (...args: unknown[]) => mockLoadAdapters(...args),
  findAdapterByName: (...args: unknown[]) => mockFindAdapterByName(...args),
  runHooks: (...args: unknown[]) => mockRunHooks(...args),
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
  let githubAdapter: ReturnType<typeof createMockAdapter>;
  let gitlabAdapter: ReturnType<typeof createMockAdapter>;

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    githubAdapter = createMockAdapter('github', 'GitHub');
    gitlabAdapter = createMockAdapter('gitlab', 'GitLab');

    mockResolveToken.mockResolvedValue('mock-token');
    mockLoadGitpmConfig.mockResolvedValue({
      ok: true,
      value: {
        adapters: ['@gitpm/sync-github', '@gitpm/sync-gitlab'],
        hooks: {},
      },
    });
    mockLoadAdapters.mockResolvedValue({
      ok: true,
      value: [githubAdapter, gitlabAdapter],
    });
    mockFindAdapterByName.mockImplementation(
      (_adapters: unknown[], name: string) => {
        if (name === 'github') return githubAdapter;
        if (name === 'gitlab') return gitlabAdapter;
        return null;
      },
    );
    mockRunHooks.mockResolvedValue({ ok: true, value: undefined });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- GitHub ---

  it('imports from GitHub successfully', async () => {
    mockAdapterImport.mockResolvedValue({ ok: true, value: importSummary });

    await run('--repo', 'owner/repo', '--meta-dir', '/tmp/meta');

    expect(mockAdapterImport).toHaveBeenCalledWith(
      expect.objectContaining({
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

  it('passes --link-strategy to adapter', async () => {
    mockAdapterImport.mockResolvedValue({ ok: true, value: importSummary });

    await run(
      '--repo',
      'owner/repo',
      '--link-strategy',
      'labels',
      '--meta-dir',
      '/tmp/meta',
    );

    expect(mockAdapterImport).toHaveBeenCalledWith(
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
    mockAdapterImport.mockResolvedValue({
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

  // --- GitLab ---

  it('imports from GitLab successfully', async () => {
    mockAdapterImport.mockResolvedValue({ ok: true, value: importSummary });

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

    expect(mockFindAdapterByName).toHaveBeenCalledWith(
      expect.anything(),
      'gitlab',
    );
    expect(mockAdapterImport).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits with code 1 for unknown source', async () => {
    mockFindAdapterByName.mockReturnValue(null);

    await expect(
      run('--source', 'bitbucket', '--meta-dir', '/tmp/meta'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('not found');
  });

  it('runs pre-import and post-import hooks', async () => {
    mockAdapterImport.mockResolvedValue({ ok: true, value: importSummary });

    await run('--repo', 'owner/repo', '--meta-dir', '/tmp/meta');

    expect(mockRunHooks).toHaveBeenCalledWith(
      expect.anything(),
      'pre-import',
      expect.objectContaining({ event: 'pre-import' }),
    );
    expect(mockRunHooks).toHaveBeenCalledWith(
      expect.anything(),
      'post-import',
      expect.objectContaining({ event: 'post-import' }),
    );
  });
});
