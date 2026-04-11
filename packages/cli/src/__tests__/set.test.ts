import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockParseFile = vi.fn();
const mockParseAssignment = vi.fn();
const mockApplyAssignments = vi.fn();
const mockWriteFile = vi.fn();

vi.mock('@gitpm/core', () => ({
  parseFile: (...args: unknown[]) => mockParseFile(...args),
  parseAssignment: (...args: unknown[]) => mockParseAssignment(...args),
  applyAssignments: (...args: unknown[]) => mockApplyAssignments(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let _errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { setCommand } = await import('../commands/set.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(setCommand);
  await program.parseAsync(['node', 'gitpm', 'set', ...args]);
}

// --- Tests ---

describe('gitpm set', () => {
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

  it('parses and applies assignments to an entity', async () => {
    const entity = { type: 'story', id: 's1', title: 'Test' };
    const updated = { ...entity, priority: 'high' };

    mockParseFile.mockResolvedValue({ ok: true, value: entity });
    mockParseAssignment.mockReturnValue({
      ok: true,
      value: { field: 'priority', operator: '=', value: 'high' },
    });
    mockApplyAssignments.mockReturnValue({ ok: true, value: updated });
    mockWriteFile.mockResolvedValue({ ok: true, value: undefined });

    await run('/tmp/story.md', 'priority=high');

    expect(mockParseFile).toHaveBeenCalled();
    expect(mockParseAssignment).toHaveBeenCalledWith('priority=high');
    expect(mockApplyAssignments).toHaveBeenCalledWith(entity, [
      { field: 'priority', operator: '=', value: 'high' },
    ]);
    expect(mockWriteFile).toHaveBeenCalledWith(updated, expect.any(String));
  });

  it('handles multiple assignments', async () => {
    const entity = { type: 'story', id: 's1', title: 'Test' };
    const updated = { ...entity, priority: 'high', status: 'todo' };

    mockParseFile.mockResolvedValue({ ok: true, value: entity });
    mockParseAssignment
      .mockReturnValueOnce({
        ok: true,
        value: { field: 'priority', operator: '=', value: 'high' },
      })
      .mockReturnValueOnce({
        ok: true,
        value: { field: 'status', operator: '=', value: 'todo' },
      });
    mockApplyAssignments.mockReturnValue({ ok: true, value: updated });
    mockWriteFile.mockResolvedValue({ ok: true, value: undefined });

    await run('/tmp/story.md', 'priority=high', 'status=todo');

    expect(mockApplyAssignments).toHaveBeenCalledWith(entity, [
      { field: 'priority', operator: '=', value: 'high' },
      { field: 'status', operator: '=', value: 'todo' },
    ]);
  });

  it('exits with code 1 when parseFile fails', async () => {
    mockParseFile.mockResolvedValue({
      ok: false,
      error: { message: 'file not found' },
    });

    await expect(run('/tmp/missing.md', 'priority=high')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when assignment parsing fails', async () => {
    mockParseFile.mockResolvedValue({
      ok: true,
      value: { type: 'story' },
    });
    mockParseAssignment.mockReturnValue({
      ok: false,
      error: { message: 'Invalid expression' },
    });

    await expect(run('/tmp/story.md', 'badexpr')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when applyAssignments fails', async () => {
    mockParseFile.mockResolvedValue({
      ok: true,
      value: { type: 'story' },
    });
    mockParseAssignment.mockReturnValue({
      ok: true,
      value: { field: 'status', operator: '=', value: 'invalid' },
    });
    mockApplyAssignments.mockReturnValue({
      ok: false,
      error: { message: 'Validation failed' },
    });

    await expect(run('/tmp/story.md', 'status=invalid')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when writeFile fails', async () => {
    mockParseFile.mockResolvedValue({
      ok: true,
      value: { type: 'story' },
    });
    mockParseAssignment.mockReturnValue({
      ok: true,
      value: { field: 'priority', operator: '=', value: 'high' },
    });
    mockApplyAssignments.mockReturnValue({
      ok: true,
      value: { type: 'story', priority: 'high' },
    });
    mockWriteFile.mockResolvedValue({
      ok: false,
      error: { message: 'write error' },
    });

    await expect(run('/tmp/story.md', 'priority=high')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints success message on successful update', async () => {
    mockParseFile.mockResolvedValue({
      ok: true,
      value: { type: 'story' },
    });
    mockParseAssignment.mockReturnValue({
      ok: true,
      value: { field: 'priority', operator: '=', value: 'high' },
    });
    mockApplyAssignments.mockReturnValue({
      ok: true,
      value: { type: 'story', priority: 'high' },
    });
    mockWriteFile.mockResolvedValue({ ok: true, value: undefined });

    await run('/tmp/story.md', 'priority=high');

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Updated');
  });
});
