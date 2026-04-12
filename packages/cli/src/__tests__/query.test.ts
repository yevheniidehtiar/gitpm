import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockParseTree = vi.fn();
const mockFilterEntities = vi.fn();
const mockFormatEntities = vi.fn();

vi.mock('@gitpm/core', () => ({
  parseTree: (...args: unknown[]) => mockParseTree(...args),
  filterEntities: (...args: unknown[]) => mockFilterEntities(...args),
  formatEntities: (...args: unknown[]) => mockFormatEntities(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let _errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { queryCommand } = await import('../commands/query.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(queryCommand);
  await program.parseAsync(['node', 'gitpm', 'query', ...args]);
}

function makeTree() {
  return {
    stories: [{ id: 's1', type: 'story', title: 'Story 1' }],
    epics: [],
    milestones: [],
    roadmaps: [],
    prds: [],
    sprints: [],
    errors: [],
  };
}

// --- Tests ---

describe('gitpm query', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    _errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls filterEntities with parsed filters', async () => {
    const tree = makeTree();
    mockParseTree.mockResolvedValue({ ok: true, value: tree });
    mockFilterEntities.mockReturnValue([]);
    mockFormatEntities.mockReturnValue('No matching entities found.');

    await run('--type', 'story', '--status', 'todo', '--meta-dir', '/tmp/test');

    expect(mockFilterEntities).toHaveBeenCalledWith(tree, {
      type: ['story'],
      status: ['todo'],
    });
  });

  it('passes format and fields to formatEntities', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockFilterEntities.mockReturnValue([]);
    mockFormatEntities.mockReturnValue('[]');

    await run(
      '--format',
      'json',
      '--fields',
      'id,title',
      '--meta-dir',
      '/tmp/test',
    );

    expect(mockFormatEntities).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        fields: ['id', 'title'],
        format: 'json',
      }),
    );
  });

  it('outputs the formatted result', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockFilterEntities.mockReturnValue([]);
    mockFormatEntities.mockReturnValue('formatted output');

    await run('--meta-dir', '/tmp/test');

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('formatted output');
  });

  it('exits with code 1 when parseTree fails', async () => {
    mockParseTree.mockResolvedValue({
      ok: false,
      error: { message: 'cannot read' },
    });

    await expect(run('--meta-dir', '/tmp/test')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('parses label filter', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockFilterEntities.mockReturnValue([]);
    mockFormatEntities.mockReturnValue('');

    await run('--label', 'frontend,responsive', '--meta-dir', '/tmp/test');

    expect(mockFilterEntities).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ labels: ['frontend', 'responsive'] }),
    );
  });

  it('parses priority filter', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockFilterEntities.mockReturnValue([]);
    mockFormatEntities.mockReturnValue('');

    await run('--priority', 'high,critical', '--meta-dir', '/tmp/test');

    expect(mockFilterEntities).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ priority: ['high', 'critical'] }),
    );
  });

  it('parses epic filter', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockFilterEntities.mockReturnValue([]);
    mockFormatEntities.mockReturnValue('');

    await run('--epic', 'epic-responsive', '--meta-dir', '/tmp/test');

    expect(mockFilterEntities).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ epic: 'epic-responsive' }),
    );
  });

  it('parses search filter', async () => {
    mockParseTree.mockResolvedValue({ ok: true, value: makeTree() });
    mockFilterEntities.mockReturnValue([]);
    mockFormatEntities.mockReturnValue('');

    await run('--search', 'responsive', '--meta-dir', '/tmp/test');

    expect(mockFilterEntities).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ search: 'responsive' }),
    );
  });
});
