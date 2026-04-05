import { describe, expect, it } from 'vitest';
import { applyResolutions, resolveConflicts } from '../conflict.js';
import type { FieldConflict, Resolution } from '../types.js';

const sampleConflicts: FieldConflict[] = [
  {
    entityId: 's1',
    entityTitle: 'Story A',
    entityType: 'story',
    field: 'title',
    baseValue: 'Original',
    localValue: 'Local Title',
    remoteValue: 'Remote Title',
  },
  {
    entityId: 's1',
    entityTitle: 'Story A',
    entityType: 'story',
    field: 'status',
    baseValue: 'todo',
    localValue: 'in_progress',
    remoteValue: 'done',
  },
];

describe('resolveConflicts', () => {
  it('returns local picks for local-wins strategy', () => {
    const resolutions = resolveConflicts(sampleConflicts, 'local-wins');
    expect(resolutions).toHaveLength(2);
    expect(resolutions.every((r) => r.pick === 'local')).toBe(true);
  });

  it('returns remote picks for remote-wins strategy', () => {
    const resolutions = resolveConflicts(sampleConflicts, 'remote-wins');
    expect(resolutions).toHaveLength(2);
    expect(resolutions.every((r) => r.pick === 'remote')).toBe(true);
  });

  it('returns empty for ask strategy', () => {
    const resolutions = resolveConflicts(sampleConflicts, 'ask');
    expect(resolutions).toHaveLength(0);
  });
});

describe('applyResolutions', () => {
  it('keeps local values when pick is local', () => {
    const localFields = { title: 'Local Title', status: 'in_progress' };
    const remoteFields = { title: 'Remote Title', status: 'done' };
    const resolutions: Resolution[] = [
      { entityId: 's1', field: 'title', pick: 'local' },
      { entityId: 's1', field: 'status', pick: 'local' },
    ];

    const merged = applyResolutions(
      localFields,
      remoteFields,
      sampleConflicts,
      resolutions,
    );
    expect(merged.title).toBe('Local Title');
    expect(merged.status).toBe('in_progress');
  });

  it('applies remote values when pick is remote', () => {
    const localFields = { title: 'Local Title', status: 'in_progress' };
    const remoteFields = { title: 'Remote Title', status: 'done' };
    const resolutions: Resolution[] = [
      { entityId: 's1', field: 'title', pick: 'remote' },
      { entityId: 's1', field: 'status', pick: 'remote' },
    ];

    const merged = applyResolutions(
      localFields,
      remoteFields,
      sampleConflicts,
      resolutions,
    );
    expect(merged.title).toBe('Remote Title');
    expect(merged.status).toBe('done');
  });

  it('handles mixed resolutions', () => {
    const localFields = { title: 'Local Title', status: 'in_progress' };
    const remoteFields = { title: 'Remote Title', status: 'done' };
    const resolutions: Resolution[] = [
      { entityId: 's1', field: 'title', pick: 'remote' },
      { entityId: 's1', field: 'status', pick: 'local' },
    ];

    const merged = applyResolutions(
      localFields,
      remoteFields,
      sampleConflicts,
      resolutions,
    );
    expect(merged.title).toBe('Remote Title');
    expect(merged.status).toBe('in_progress');
  });
});
