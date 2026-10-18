import type { DiffResult, FieldConflict } from '@gitpm/core';
import { describe, expect, it } from 'vitest';
import { mergeFields, resolveConflicts } from '../conflict.js';
import type { SyncFields } from '../diff.js';

const conflict: FieldConflict = {
  entityId: 'st_1',
  entityTitle: 'Card form',
  entityType: 'story',
  field: 'title',
  baseValue: null,
  localValue: 'Local',
  remoteValue: 'Remote',
};

const local: SyncFields = {
  title: 'Local',
  status: 'todo',
  priority: 'medium',
  assignee: null,
  kind: 'task',
  body: 'Local body',
  epic: null,
};
const remote: SyncFields = {
  ...local,
  title: 'Remote',
  priority: 'high',
};

describe('resolveConflicts', () => {
  it.each([
    ['local-wins', 'local'],
    ['remote-wins', 'remote'],
  ] as const)('%s picks %s for every conflict', (strategy, pick) => {
    expect(resolveConflicts([conflict], strategy)).toEqual([
      { entityId: 'st_1', field: 'title', pick },
    ]);
  });

  it('resolves nothing with ask', () => {
    expect(resolveConflicts([conflict], 'ask')).toEqual([]);
  });
});

describe('mergeFields', () => {
  const diff: DiffResult = {
    status: 'conflict',
    localChanges: [],
    remoteChanges: [
      { field: 'priority', oldValue: 'medium', newValue: 'high' },
    ],
    conflicts: [conflict],
  };

  it('applies remote changes and the picked side of each conflict', () => {
    expect(
      mergeFields(local, remote, diff, [
        { entityId: 'st_1', field: 'title', pick: 'remote' },
      ]),
    ).toEqual({ ...local, title: 'Remote', priority: 'high' });
    expect(
      mergeFields(local, remote, diff, [
        { entityId: 'st_1', field: 'title', pick: 'local' },
      ]),
    ).toEqual({ ...local, priority: 'high' });
  });
});
