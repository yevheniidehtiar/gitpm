import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockParseTree = vi.fn();
const mockResolveRefs = vi.fn();
const mockLoadQualityConfig = vi.fn();
const mockScoreEntities = vi.fn();

vi.mock('@gitpm/core', () => ({
  parseTree: (...args: unknown[]) => mockParseTree(...args),
  resolveRefs: (...args: unknown[]) => mockResolveRefs(...args),
  loadQualityConfig: (...args: unknown[]) => mockLoadQualityConfig(...args),
  scoreEntities: (...args: unknown[]) => mockScoreEntities(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { qualityCommand } = await import('../commands/quality.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(qualityCommand);
  await program.parseAsync(['node', 'gitpm', 'quality', ...args]);
}

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    distribution: { A: 2, B: 3, C: 1, D: 1, F: 1 },
    average: 6.5,
    entities: [
      {
        id: 'st_1',
        score: 3,
        maxScore: 9,
        grade: 'D',
        filePath: '/tmp/.meta/stories/low.md',
      },
      {
        id: 'st_2',
        score: 1,
        maxScore: 9,
        grade: 'F',
        filePath: '/tmp/.meta/stories/fail.md',
      },
      {
        id: 'st_3',
        score: 8,
        maxScore: 9,
        grade: 'A',
        filePath: '/tmp/.meta/stories/good.md',
      },
    ],
    ...overrides,
  };
}

// --- Tests ---

describe('gitpm quality', () => {
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
    mockLoadQualityConfig.mockResolvedValue({ ok: true, value: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits 1 when parseTree fails', async () => {
    mockParseTree.mockResolvedValue({
      ok: false,
      error: { message: 'parse err' },
    });
    await expect(run('--meta-dir', '/tmp/m')).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when resolveRefs fails', async () => {
    mockResolveRefs.mockReturnValue({
      ok: false,
      error: { message: 'resolve err' },
    });
    await expect(run('--meta-dir', '/tmp/m')).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when loadQualityConfig fails', async () => {
    mockLoadQualityConfig.mockResolvedValue({
      ok: false,
      error: { message: 'config err' },
    });
    await expect(run('--meta-dir', '/tmp/m')).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints "no entities" when report is empty', async () => {
    mockScoreEntities.mockReturnValue({
      distribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      average: 0,
      entities: [],
    });

    await run('--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('No scorable entities');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prints report with grades and lowest-scoring entities', async () => {
    mockScoreEntities.mockReturnValue(makeReport());

    await run('--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('Entity Quality Report');
    expect(logOutput).toContain('A (8-9)');
    expect(logOutput).toContain('B (6-7)');
    expect(logOutput).toContain('C (4-5)');
    expect(logOutput).toContain('D (2-3)');
    expect(logOutput).toContain('F (0-1)');
    expect(logOutput).toContain('Average:');
    expect(logOutput).toContain('Lowest scoring');
    expect(logOutput).toContain('st_1');
    expect(logOutput).toContain('st_2');
    // st_3 scored 8, above 6 threshold, not in lowest
    expect(logOutput).not.toContain('st_3');
  });

  it('uses singular "entity" for a distribution of 1', async () => {
    mockScoreEntities.mockReturnValue({
      distribution: { A: 1, B: 2, C: 0, D: 0, F: 0 },
      average: 7,
      entities: [
        {
          id: 'st_1',
          score: 7,
          maxScore: 9,
          grade: 'B',
          filePath: '/tmp/x.md',
        },
      ],
    });

    await run('--meta-dir', '/tmp/m');

    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toMatch(/A \(8-9\):\s+1 entity\b/);
    expect(logOutput).toMatch(/B \(6-7\):\s+2 entities\b/);
  });

  it('renders all grade buckets for averages (A/B/C/D/F)', async () => {
    const stubEntity = {
      id: 'e',
      score: 5,
      maxScore: 9,
      grade: 'C',
      filePath: '/tmp/x.md',
    };
    const averages = [9, 7, 5, 3, 0];
    for (const avg of averages) {
      vi.resetAllMocks();
      mockParseTree.mockResolvedValue({ ok: true, value: {} });
      mockResolveRefs.mockReturnValue({ ok: true, value: {} });
      mockLoadQualityConfig.mockResolvedValue({ ok: true, value: null });
      mockScoreEntities.mockReturnValue({
        distribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
        average: avg,
        entities: [stubEntity],
      });
      await run('--meta-dir', '/tmp/m');
      const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logOutput).toContain(`${avg}.0`);
    }
  });

  it('exits 1 when average is below --threshold', async () => {
    mockScoreEntities.mockReturnValue(makeReport({ average: 3 }));

    await expect(
      run('--threshold', '5', '--meta-dir', '/tmp/m'),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('below threshold');
  });

  it('uses config threshold when --threshold is not set', async () => {
    mockLoadQualityConfig.mockResolvedValue({
      ok: true,
      value: { threshold: { min_average: 8 } },
    });
    mockScoreEntities.mockReturnValue(makeReport({ average: 6 }));

    await expect(run('--meta-dir', '/tmp/m')).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('passes config to scoreEntities', async () => {
    const cfg = { threshold: { min_average: 5 } };
    mockLoadQualityConfig.mockResolvedValue({ ok: true, value: cfg });
    mockScoreEntities.mockReturnValue(makeReport({ average: 8 }));

    await run('--meta-dir', '/tmp/m');

    expect(mockScoreEntities).toHaveBeenCalledWith(expect.anything(), cfg);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
