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
        daysSinceUpdate: 120,
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

  describe('--markdown', () => {
    it('prints a Markdown report with section headers and tables', async () => {
      mockAuditTree.mockReturnValue(fullReport());

      await expect(
        run('--markdown', '--meta-dir', '/tmp/meta'),
      ).rejects.toThrow('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);

      const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logOutput).toContain('# Project Audit');
      expect(logOutput).toContain('## Stale (1)');
      expect(logOutput).toContain('## Orphans (1)');
      expect(logOutput).toContain('## Duplicates (2)');
      expect(logOutput).toContain('## Empty bodies (1)');
      expect(logOutput).toContain('## Zombie epics (1)');
      expect(logOutput).toContain('| ID | Title | File | Reason |');
      expect(logOutput).toContain('Stale story');
      expect(logOutput).toContain('Duplicate A');
      expect(logOutput).toContain('92%');
    });

    it('tiers stale items into age buckets', async () => {
      mockAuditTree.mockReturnValue({
        summary: { total: 3, issues: 3 },
        stale: [
          {
            id: 'st_30',
            title: 'Thirty-something',
            reason: '45 days since last update',
            filePath: '/tmp/.meta/stories/a.md',
            daysSinceUpdate: 45,
          },
          {
            id: 'st_60',
            title: 'Sixty-something',
            reason: '75 days since last update',
            filePath: '/tmp/.meta/stories/b.md',
            daysSinceUpdate: 75,
          },
          {
            id: 'st_90',
            title: 'Ninety-plus',
            reason: '200 days since last update',
            filePath: '/tmp/.meta/stories/c.md',
            daysSinceUpdate: 200,
          },
        ],
        orphans: [],
        emptyBodies: [],
        zombieEpics: [],
        duplicates: [],
      });

      await expect(
        run('--markdown', '--meta-dir', '/tmp/meta'),
      ).rejects.toThrow('process.exit');

      const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logOutput).toContain('### 30-59 days (1)');
      expect(logOutput).toContain('### 60-89 days (1)');
      expect(logOutput).toContain('### 90+ days (1)');
      expect(logOutput).toContain('Thirty-something');
      expect(logOutput).toContain('Sixty-something');
      expect(logOutput).toContain('Ninety-plus');
    });

    it('collects stale items from the 30-day tier by default', async () => {
      mockAuditTree.mockReturnValue(emptyReport());

      await run('--markdown', '--meta-dir', '/tmp/meta');

      expect(mockAuditTree).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ staleDays: 30 }),
      );
    });

    it('respects an explicit --stale-days', async () => {
      mockAuditTree.mockReturnValue(emptyReport());

      await run('--markdown', '--stale-days', '60', '--meta-dir', '/tmp/meta');

      expect(mockAuditTree).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ staleDays: 60 }),
      );
    });

    it('renders 30-59 and 60-89 tiers with default flags using the real auditTree', async () => {
      const actual =
        await vi.importActual<typeof import('@gitpm/core')>('@gitpm/core');
      mockAuditTree.mockImplementation(actual.auditTree);
      const daysAgo = (n: number) =>
        new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
      const story = (id: string, title: string, days: number) => ({
        type: 'story',
        id,
        title,
        status: 'todo',
        priority: 'medium',
        assignee: null,
        labels: [],
        estimate: null,
        epic_ref: { id: 'ep_1' },
        updated_at: daysAgo(days),
        body: `Body for ${title}`,
        filePath: `/tmp/.meta/stories/${id}.md`,
      });
      mockResolveRefs.mockReturnValue({
        ok: true,
        value: {
          stories: [
            story('st_45', 'Forty-five alpha', 45),
            story('st_75', 'Seventy-five bravo', 75),
            story('st_120', 'One-twenty charlie', 120),
          ],
          epics: [],
          milestones: [],
          roadmaps: [],
          prds: [],
          sprints: [],
        },
      });

      await expect(
        run('--markdown', '--meta-dir', '/tmp/meta'),
      ).rejects.toThrow('process.exit');

      const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logOutput).toContain('### 30-59 days (1)');
      expect(logOutput).toContain('### 60-89 days (1)');
      expect(logOutput).toContain('### 90+ days (1)');
      expect(logOutput).toContain('Forty-five alpha');
      expect(logOutput).toContain('Seventy-five bravo');
    });

    it('prints "None." for empty sections', async () => {
      mockAuditTree.mockReturnValue(emptyReport());

      await run('--markdown', '--meta-dir', '/tmp/meta');

      const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logOutput).toContain('## Stale (0)');
      expect(logOutput).toContain('None.');
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });
});
