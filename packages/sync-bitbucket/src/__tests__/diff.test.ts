import type { Epic, Story } from '@gitpm/core';
import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../config.js';
import type { SyncFields } from '../diff.js';
import {
  diffSyncFields,
  fieldHashes,
  localFields,
  remoteFields,
} from '../diff.js';
import type { BbIssue } from '../types.js';

const parsed = createDefaultConfig('acme', 'widgets');
if (!parsed.ok) throw parsed.error;
const config = parsed.value;

const story: Story = {
  type: 'story',
  id: 'st_1',
  title: 'Card form',
  status: 'in_review',
  priority: 'medium',
  assignee: 'ada',
  labels: ['frontend', 'kind:bug'],
  epic_ref: { id: 'ep_1' },
  body: 'Body  \r\nline\n',
  filePath: 'stories/card-form.md',
};

const issue: BbIssue = {
  id: 41,
  title: 'Card form',
  content: { raw: 'Body\nline\n\n<!-- gitpm:epic=ep_1 -->' },
  state: 'open',
  kind: 'bug',
  priority: 'major',
  assignee: { display_name: 'Ada', nickname: 'ada' },
  reporter: null,
  milestone: null,
  component: null,
  version: null,
  votes: 0,
  created_on: '2026-09-01T00:00:00.000000+00:00',
  updated_on: '2026-09-01T00:00:00.000000+00:00',
};

describe('localFields', () => {
  it('maps a story to sync fields with a normalised body', () => {
    expect(localFields(story, config)).toEqual({
      title: 'Card form',
      status: 'in_review',
      priority: 'medium',
      assignee: 'ada',
      kind: 'bug',
      body: 'Body\nline',
      epic: 'ep_1',
    });
  });

  it('uses the owner and no epic for an epic', () => {
    const epic: Epic = {
      type: 'epic',
      id: 'ep_1',
      title: 'Checkout',
      status: 'todo',
      priority: 'high',
      owner: 'linus',
      labels: [],
      body: '',
      filePath: 'epics/checkout/epic.md',
    };
    expect(localFields(epic, config)).toMatchObject({
      assignee: 'linus',
      kind: 'task',
      epic: null,
    });
  });
});

describe('remoteFields', () => {
  it('keeps local values the remote ones are a lossy image of', () => {
    const local = localFields(story, config);
    expect(remoteFields(issue, local, config, 'ep_1')).toEqual(local);
  });

  it('maps remote values that the local ones would not have written', () => {
    const local = localFields(story, config);
    const remote = remoteFields(
      { ...issue, state: 'resolved', priority: 'blocker', assignee: null },
      local,
      config,
      null,
    );
    expect(remote).toMatchObject({
      status: 'done',
      priority: 'critical',
      assignee: null,
      epic: null,
    });
  });
});

describe('diffSyncFields', () => {
  const base: SyncFields = localFields(story, config);
  const hashes = fieldHashes(base);
  const fieldsBaseline = {
    kind: 'fields' as const,
    local: hashes,
    remote: hashes,
  };

  it('is in sync when nothing differs', () => {
    const diff = diffSyncFields(story, base, base, fieldsBaseline);
    expect(diff.status).toBe('in_sync');
  });

  it('splits local, remote and conflicting field changes', () => {
    const local = { ...base, title: 'Local', body: 'Same new body' };
    const remote = {
      ...base,
      title: 'Remote',
      priority: 'high' as const,
      body: 'Same new body',
    };
    const diff = diffSyncFields(story, local, remote, fieldsBaseline);

    expect(diff.status).toBe('conflict');
    expect(diff.conflicts.map((c) => c.field)).toEqual(['title']);
    expect(diff.remoteChanges).toEqual([
      { field: 'priority', oldValue: 'medium', newValue: 'high' },
    ]);
    expect(diff.localChanges).toEqual([]);
  });

  it('reports a local-only change', () => {
    const local = { ...base, assignee: 'linus' };
    const diff = diffSyncFields(story, local, base, fieldsBaseline);
    expect(diff.status).toBe('local_changed');
    expect(diff.localChanges).toEqual([
      { field: 'assignee', oldValue: 'ada', newValue: 'linus' },
    ]);
  });

  it('ignores a difference neither side introduced', () => {
    const remote = { ...base, epic: null };
    const diff = diffSyncFields(story, base, remote, {
      kind: 'fields',
      local: hashes,
      remote: fieldHashes(remote),
    });
    expect(diff.status).toBe('in_sync');
  });

  it('falls back to whole-entity flags without field hashes', () => {
    const local = { ...base, title: 'Local' };
    const remote = { ...base, priority: 'high' as const };

    expect(
      diffSyncFields(story, local, remote, {
        kind: 'whole',
        localChanged: true,
        remoteChanged: false,
      }).localChanges.map((c) => c.field),
    ).toEqual(['title', 'priority']);
    expect(
      diffSyncFields(story, local, remote, {
        kind: 'whole',
        localChanged: true,
        remoteChanged: true,
      }).conflicts.map((c) => c.field),
    ).toEqual(['title', 'priority']);
  });
});
