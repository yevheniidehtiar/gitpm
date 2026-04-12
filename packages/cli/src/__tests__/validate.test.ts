import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockParseTree = vi.fn();
const mockResolveRefs = vi.fn();
const mockValidateTree = vi.fn();

vi.mock('@gitpm/core', () => ({
  parseTree: (...args: unknown[]) => mockParseTree(...args),
  resolveRefs: (...args: unknown[]) => mockResolveRefs(...args),
  validateTree: (...args: unknown[]) => mockValidateTree(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { validateCommand } = await import('../commands/validate.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(validateCommand);
  await program.parseAsync(['node', 'gitpm', 'validate', ...args]);
}

// --- Helpers ---

function makeTree(
  overrides?: Partial<{
    stories: unknown[];
    epics: unknown[];
    milestones: unknown[];
    roadmaps: unknown[];
    prds: unknown[];
    errors: unknown[];
  }>,
) {
  return {
    stories: [],
    epics: [],
    milestones: [],
    roadmaps: [],
    prds: [],
    sprints: [],
    errors: [],
    ...overrides,
  };
}

// --- Tests ---

describe('gitpm validate', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints success for a valid tree with no warnings', async () => {
    const tree = makeTree({
      stories: [{ id: 's1' }, { id: 's2' }],
      epics: [{ id: 'e1' }],
    });
    mockParseTree.mockResolvedValue({ ok: true, value: tree });
    mockResolveRefs.mockReturnValue({ ok: true, value: { resolved: true } });
    mockValidateTree.mockReturnValue({ valid: true, errors: [], warnings: [] });

    await run('--meta-dir', '/tmp/test-meta');

    expect(exitSpy).not.toHaveBeenCalled();
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('3 entities');
  });

  it('prints warnings but does not exit for a valid tree with warnings', async () => {
    const tree = makeTree({ stories: [{ id: 's1' }] });
    mockParseTree.mockResolvedValue({ ok: true, value: tree });
    mockResolveRefs.mockReturnValue({ ok: true, value: {} });
    mockValidateTree.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [
        {
          filePath: '/tmp/test.md',
          entityId: 'w1',
          code: 'WARN_01',
          message: 'something fishy',
        },
      ],
    });

    await run('--meta-dir', '/tmp/test-meta');

    expect(exitSpy).not.toHaveBeenCalled();
    const warnOutput = warnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(warnOutput).toContain('1 warning(s)');
  });

  it('exits with code 1 for an invalid tree', async () => {
    const tree = makeTree();
    mockParseTree.mockResolvedValue({ ok: true, value: tree });
    mockResolveRefs.mockReturnValue({ ok: true, value: {} });
    mockValidateTree.mockReturnValue({
      valid: false,
      errors: [
        {
          filePath: '/tmp/bad.md',
          entityId: 'e1',
          code: 'ERR_01',
          message: 'bad entity',
        },
      ],
      warnings: [],
    });

    await expect(run('--meta-dir', '/tmp/test-meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when parseTree fails', async () => {
    mockParseTree.mockResolvedValue({
      ok: false,
      error: { message: 'cannot read .meta' },
    });

    await expect(run('--meta-dir', '/tmp/test-meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('cannot read .meta');
  });

  it('exits with code 1 when resolveRefs fails', async () => {
    const tree = makeTree();
    mockParseTree.mockResolvedValue({ ok: true, value: tree });
    mockResolveRefs.mockReturnValue({
      ok: false,
      error: { message: 'broken ref' },
    });

    await expect(run('--meta-dir', '/tmp/test-meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('broken ref');
  });

  it('prints parse errors from the tree', async () => {
    const tree = makeTree({
      errors: [
        { filePath: '/tmp/bad-story.md', message: 'invalid frontmatter' },
      ],
    });
    mockParseTree.mockResolvedValue({ ok: true, value: tree });
    mockResolveRefs.mockReturnValue({ ok: true, value: {} });
    mockValidateTree.mockReturnValue({ valid: true, errors: [], warnings: [] });

    await run('--meta-dir', '/tmp/test-meta');

    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('invalid frontmatter');
  });
});
