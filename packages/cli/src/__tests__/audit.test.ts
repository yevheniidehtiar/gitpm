import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockParseTree = vi.fn();
const mockResolveRefs = vi.fn();
const mockAuditTree = vi.fn();

vi.mock('@gitpm/core', () => ({
  parseTree: (...args: unknown[]) => mockParseTree(...args),
  resolveRefs: (...args: unknown[]) => mockResolveRefs(...args),
  auditTree: (...args: unknown[]) => mockAuditTree(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { auditCommand } = await import('../commands/audit.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(auditCommand);
  await program.parseAsync(['node', 'gitpm', 'audit', ...args]);
}

function emptyReport() {
  return {
    summary: { total: 5, issues: 0 },
    stale: [],
    orphans: [],
    emptyBodies: [],
    zombieEpics: [],
    duplicates: [],
  };
}

function fullReport() {
  return {
    summary: { total: 10, issues: 6 },
    stale: [
      {
        id: 'st_1',
        title: 'Stale story',
        reason: '120 days old',
        filePath: '/tmp/.meta/stories/stale.md',
      },
    ],
    orphans: [
      {
        id: 'st_2',
        title: 'Orphan story',
        reason: 'no epic',
        filePath: '/tmp/.meta/stories/orphan.md',
      },
    ],
    emptyBodies: [
      {
        id: 'st_3',
        title: 'Empty body',
        reason: 'empty body',
        filePath: '/tmp/.meta/stories/empty.md',
      },
    ],
    zombieEpics: [
      {
        id: 'ep_1',
        title: 'Zombie epic',
        reason: 'all stories done',
        filePath: '/tmp/.meta/epics/zombie/epic.md',
      },
    ],
    duplicates: [
      {
        a: { id: 'st_4', title: 'Duplicate A' },
        b: { id: 'st_5', title: 'Duplicate B' },
        similarity: 0.92,
      },
      {
        a: { id: 'st_6', title: 'Dup A2' },
        b: { id: 'st_7', title: 'Dup B2' },
        similarity: 0.8,
      },
    ],
  };
}

// --- Tests ---

describe('gitpm audit', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    mockParseTree.mockResolvedValue({ ok: true, value: {} });
    mockResolveRefs.mockReturnValue({ ok: true, value: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits 1 when parseTree fails', async () => {
    mockParseTree.mockResolvedValue({
      ok: false,
      error: { message: 'parse failed' },
    });

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('parse failed');
  });

  it('exits 1 when resolveRefs fails', async () => {
    mockResolveRefs.mockReturnValue({
      ok: false,
      error: { message: 'resolve failed' },
    });

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('resolve failed');
  });

  it('prints success when no issues found', async () => {
    mockAuditTree.mockReturnValue(emptyReport());

    await run('--meta-dir', '/tmp/meta');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('No issues found');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('outputs JSON when --json is set', async () => {
    const report = fullReport();
    mockAuditTree.mockReturnValue(report);

    await expect(run('--json', '--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    const parsed = JSON.parse(logOutput);
    expect(parsed.summary.issues).toBe(6);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints sections and exits 1 when issues found', async () => {
    mockAuditTree.mockReturnValue(fullReport());

    await expect(run('--meta-dir', '/tmp/meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Project Audit');
    expect(logOutput).toContain('Stale Stories');
    expect(logOutput).toContain('Orphan Stories');
    expect(logOutput).toContain('Empty Bodies');
    expect(logOutput).toContain('Zombie Epics');
    expect(logOutput).toContain('Duplicate Candidates');
    expect(logOutput).toContain('Stale story');
    expect(logOutput).toContain('Duplicate A');
    expect(logOutput).toContain('92%');
  });

  it('passes staleDays to auditTree', async () => {
    mockAuditTree.mockReturnValue(emptyReport());

    await run('--meta-dir', '/tmp/meta');

    expect(mockAuditTree).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ staleDays: expect.anything() }),
    );
  });
});
