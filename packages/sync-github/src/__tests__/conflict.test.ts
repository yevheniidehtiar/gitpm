import { describe, expect, it } from 'vitest';
import { applyResolutions, resolveConflicts } from '../conflict.js';
import type { FieldConflict } from '../types.js';

const sampleConflicts: FieldConflict[] = [
  {
    entityId: 'story-001',
    entityTitle: 'Test Story',
    entityType: 'story',
    field: 'status',
    baseValue: 'todo',
    localValue: 'in_progress',
    remoteValue: 'done',
  },
  {
    entityId: 'story-001',
    entityTitle: 'Test Story',
    entityType: 'story',
    field: 'title',
    baseValue: 'Test Story',
    localValue: 'Updated Locally',
    remoteValue: 'Updated Remotely',
  },
];

describe('resolveConflicts', () => {
  it('resolves all conflicts to local with local-wins strategy', () => {
    const resolutions = resolveConflicts(sampleConflicts, 'local-wins');
    expect(resolutions).toHaveLength(2);
    expect(resolutions[0].pick).toBe('local');
    expect(resolutions[1].pick).toBe('local');
    expect(resolutions[0].entityId).toBe('story-001');
    expect(resolutions[0].field).toBe('status');
  });

  it('resolves all conflicts to remote with remote-wins strategy', () => {
    const resolutions = resolveConflicts(sampleConflicts, 'remote-wins');
    expect(resolutions).toHaveLength(2);
    expect(resolutions[0].pick).toBe('remote');
    expect(resolutions[1].pick).toBe('remote');
  });

  it('returns empty resolutions with ask strategy', () => {
    const resolutions = resolveConflicts(sampleConflicts, 'ask');
    expect(resolutions).toHaveLength(0);
  });

  it('handles empty conflicts array', () => {
    const resolutions = resolveConflicts([], 'local-wins');
    expect(resolutions).toHaveLength(0);
  });
});

describe('applyResolutions', () => {
  it('keeps local values when pick is local', () => {
    const localFields = { status: 'in_progress', title: 'Local Title' };
    const remoteFields = { status: 'done', title: 'Remote Title' };
    const resolutions = [
      { entityId: 'story-001', field: 'status', pick: 'local' as const },
      { entityId: 'story-001', field: 'title', pick: 'local' as const },
    ];
    const merged = applyResolutions(
      localFields,
      remoteFields,
      sampleConflicts,
      resolutions,
    );
    expect(merged.status).toBe('in_progress');
    expect(merged.title).toBe('Local Title');
  });

  it('applies remote values when pick is remote', () => {
    const localFields = { status: 'in_progress', title: 'Local Title' };
    const remoteFields = { status: 'done', title: 'Remote Title' };
    const resolutions = [
      { entityId: 'story-001', field: 'status', pick: 'remote' as const },
      { entityId: 'story-001', field: 'title', pick: 'remote' as const },
    ];
    const merged = applyResolutions(
      localFields,
      remoteFields,
      sampleConflicts,
      resolutions,
    );
    expect(merged.status).toBe('done');
    expect(merged.title).toBe('Updated Remotely');
  });

  it('supports mixed resolution picks', () => {
    const localFields = { status: 'in_progress', title: 'Local Title' };
    const remoteFields = { status: 'done', title: 'Remote Title' };
    const resolutions = [
      { entityId: 'story-001', field: 'status', pick: 'remote' as const },
      { entityId: 'story-001', field: 'title', pick: 'local' as const },
    ];
    const merged = applyResolutions(
      localFields,
      remoteFields,
      sampleConflicts,
      resolutions,
    );
    expect(merged.status).toBe('done');
    expect(merged.title).toBe('Local Title');
  });
});
