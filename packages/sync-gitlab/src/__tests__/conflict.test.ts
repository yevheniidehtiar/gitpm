import { describe, expect, it } from 'vitest';
import { applyResolutions, resolveConflicts } from '../conflict.js';
import type { FieldConflict } from '../types.js';

const conflict: FieldConflict = {
  entityId: 'e1',
  entityTitle: 'Test Entity',
  entityType: 'story',
  field: 'title',
  baseValue: 'Original',
  localValue: 'Local Change',
  remoteValue: 'Remote Change',
};

describe('resolveConflicts', () => {
  it('local-wins picks local for all conflicts', () => {
    const resolutions = resolveConflicts([conflict], 'local-wins');
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].pick).toBe('local');
  });

  it('remote-wins picks remote for all conflicts', () => {
    const resolutions = resolveConflicts([conflict], 'remote-wins');
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].pick).toBe('remote');
  });

  it('ask returns empty array', () => {
    const resolutions = resolveConflicts([conflict], 'ask');
    expect(resolutions).toHaveLength(0);
  });
});

describe('applyResolutions', () => {
  it('applies local pick', () => {
    const result = applyResolutions(
      { title: 'Local Change', status: 'todo' },
      { title: 'Remote Change', status: 'done' },
      [conflict],
      [{ entityId: 'e1', field: 'title', pick: 'local' }],
    );
    expect(result.title).toBe('Local Change');
    // Non-conflicting field from remote should be applied
    expect(result.status).toBe('done');
  });

  it('applies remote pick', () => {
    const result = applyResolutions(
      { title: 'Local Change', status: 'todo' },
      { title: 'Remote Change', status: 'done' },
      [conflict],
      [{ entityId: 'e1', field: 'title', pick: 'remote' }],
    );
    expect(result.title).toBe('Remote Change');
  });
});
