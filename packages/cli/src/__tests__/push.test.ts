import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockAdapterExport = vi.fn();
const mockResolveAdapter = vi.fn();
const mockResolveToken = vi.fn();
const mockConfirm = vi.fn();
const mockRunHooks = vi.fn();

vi.mock('../utils/adapters.js', () => ({
  resolveAdapter: (...args: unknown[]) => mockResolveAdapter(...args),
}));

vi.mock('../utils/auth.js', () => ({
  resolveToken: (...args: unknown[]) => mockResolveToken(...args),
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

function setupMockAdapter(name = 'github', displayName = 'GitHub') {
  const adapter = {
    name,
    displayName,
    detect: vi.fn().mockResolvedValue(true),
    import: vi.fn(),
    export: mockAdapterExport,
    sync: vi.fn(),
  };
  mockResolveAdapter.mockResolvedValue({
    adapter,
    config: { adapters: [], hooks: {} },
  });
  return adapter;
}

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
    mockRunHooks.mockResolvedValue({ ok: true, value: undefined });
    setupMockAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints preview in dry-run mode', async () => {
    mockAdapterExport.mockResolvedValue({ ok: true, value: exportResult });

    await run('--dry-run', '--meta-dir', '/tmp/meta');

    expect(mockAdapterExport).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('New issues:     2');
  });

  it('pushes when user confirms', async () => {
    mockAdapterExport
      .mockResolvedValueOnce({ ok: true, value: exportResult }) // preview
      .mockResolvedValueOnce({ ok: true, value: exportResult }); // actual push
    mockConfirm.mockResolvedValue(true);

    await run('--meta-dir', '/tmp/meta');

    expect(mockAdapterExport).toHaveBeenCalledTimes(2);
    expect(mockConfirm).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('cancels push when user declines', async () => {
    mockAdapterExport.mockResolvedValue({ ok: true, value: exportResult });
    mockConfirm.mockResolvedValue(false);

    await run('--meta-dir', '/tmp/meta');

    // Only called once for preview, not for actual push
    expect(mockAdapterExport).toHaveBeenCalledTimes(1);
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Push cancelled');
  });

  it('skips confirmation with --yes', async () => {
    mockAdapterExport
      .mockResolvedValueOnce({ ok: true, value: exportResult })
      .mockResolvedValueOnce({ ok: true, value: exportResult });

    await run('--yes', '--meta-dir', '/tmp/meta');

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockAdapterExport).toHaveBeenCalledTimes(2);
  });

  it('prints nothing-to-push when totalChanges is 0', async () => {
    mockAdapterExport.mockResolvedValue({ ok: true, value: noChangesResult });

    await run('--meta-dir', '/tmp/meta');

    expect(mockConfirm).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Nothing to push');
  });

  it('exits with code 1 when push fails', async () => {
    mockAdapterExport
      .mockResolvedValueOnce({ ok: true, value: exportResult }) // preview ok
      .mockResolvedValueOnce({ ok: false, error: { message: 'push error' } });
    mockConfirm.mockResolvedValue(true);

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
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

  it('pushes to GitLab when GitLab adapter detects', async () => {
    setupMockAdapter('gitlab', 'GitLab');
    mockAdapterExport.mockResolvedValue({ ok: true, value: exportResult });

    await run('--dry-run', '--token', 'gl-tok', '--meta-dir', '/tmp/meta');

    expect(mockAdapterExport).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('runs pre-export and post-export hooks', async () => {
    // Preview call returns changes, actual push call succeeds
    mockAdapterExport
      .mockResolvedValueOnce({ ok: true, value: exportResult })
      .mockResolvedValueOnce({ ok: true, value: exportResult });

    await run('--yes', '--meta-dir', '/tmp/meta');

    expect(mockRunHooks).toHaveBeenCalledWith(
      expect.anything(),
      'pre-export',
      expect.objectContaining({ event: 'pre-export' }),
    );
    expect(mockRunHooks).toHaveBeenCalledWith(
      expect.anything(),
      'post-export',
      expect.objectContaining({ event: 'post-export' }),
    );
  });
});
