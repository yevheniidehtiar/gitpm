import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockSelect = vi.fn();

vi.mock('@inquirer/prompts', () => ({
  select: (...args: unknown[]) => mockSelect(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;

const sampleConflict = {
  entityId: 'st_1',
  entityTitle: 'Story Title',
  entityType: 'story' as const,
  field: 'status',
  localValue: 'todo',
  remoteValue: 'done',
};

describe('promptConflictResolution', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array when no conflicts', async () => {
    const { promptConflictResolution } = await import(
      '../utils/conflict-ui.js'
    );
    const result = await promptConflictResolution([]);
    expect(result).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('prints conflict details and returns resolution for "local" pick', async () => {
    mockSelect.mockResolvedValue('local');

    const { promptConflictResolution } = await import(
      '../utils/conflict-ui.js'
    );
    const result = await promptConflictResolution([sampleConflict]);

    expect(result).toEqual([
      { entityId: 'st_1', field: 'status', pick: 'local' },
    ]);
    const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logOutput).toContain('CONFLICT');
    expect(logOutput).toContain('Story Title');
    expect(logOutput).toContain('st_1');
    expect(logOutput).toContain('story');
    expect(logOutput).toContain('status');
    expect(logOutput).toContain('todo');
    expect(logOutput).toContain('done');
  });

  it('returns resolution with "remote" pick', async () => {
    mockSelect.mockResolvedValue('remote');

    const { promptConflictResolution } = await import(
      '../utils/conflict-ui.js'
    );
    const result = await promptConflictResolution([sampleConflict]);

    expect(result).toEqual([
      { entityId: 'st_1', field: 'status', pick: 'remote' },
    ]);
  });

  it('omits skipped conflicts from result', async () => {
    mockSelect
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('local')
      .mockResolvedValueOnce('remote');

    const conflicts = [
      { ...sampleConflict, entityId: 'a' },
      { ...sampleConflict, entityId: 'b' },
      { ...sampleConflict, entityId: 'c' },
    ];

    const { promptConflictResolution } = await import(
      '../utils/conflict-ui.js'
    );
    const result = await promptConflictResolution(conflicts);

    expect(result).toEqual([
      { entityId: 'b', field: 'status', pick: 'local' },
      { entityId: 'c', field: 'status', pick: 'remote' },
    ]);
  });
});
