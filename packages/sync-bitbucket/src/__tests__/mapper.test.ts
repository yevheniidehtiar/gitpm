import type { Epic, Priority, Status, Story } from '@gitpm/core';
import { describe, expect, it } from 'vitest';
import {
  bbIssueToEpicId,
  bbIssueToFields,
  bbKindToLabel,
  bbPriorityToPriority,
  bbStateToStatus,
  entityToBbIssue,
  epicMarker,
  epicToBbLink,
  extractEpicMarker,
  labelsToBbKind,
  priorityToBbPriority,
  statusToBbState,
  stripEpicMarker,
  withEpicMarker,
} from '../mapper.js';
import type {
  BbIssue,
  BbIssueKind,
  BbIssuePriority,
  BbIssueState,
} from '../types.js';

function issue(overrides: Partial<BbIssue> = {}): BbIssue {
  return {
    id: 7,
    title: 'Fix login',
    content: { raw: 'Steps to reproduce' },
    state: 'new',
    kind: 'bug',
    priority: 'major',
    assignee: null,
    reporter: null,
    milestone: null,
    component: null,
    version: null,
    votes: 0,
    created_on: '2026-01-01T00:00:00Z',
    updated_on: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function story(overrides: Partial<Story> = {}): Story {
  return {
    type: 'story',
    id: 'story-1',
    title: 'Fix login',
    status: 'todo',
    priority: 'medium',
    assignee: null,
    labels: [],
    estimate: null,
    epic_ref: null,
    body: 'Steps to reproduce',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    filePath: '.meta/stories/fix-login.md',
    ...overrides,
  };
}

describe('status mapping', () => {
  it.each<[BbIssueState, Status]>([
    ['submitted', 'todo'],
    ['new', 'todo'],
    ['open', 'todo'],
    ['on hold', 'backlog'],
    ['resolved', 'done'],
    ['closed', 'cancelled'],
    ['invalid', 'cancelled'],
    ['duplicate', 'cancelled'],
    ['wontfix', 'cancelled'],
  ])('Bitbucket %s → %s', (state, status) => {
    expect(bbStateToStatus(state)).toBe(status);
  });

  it.each<[Status, BbIssueState]>([
    ['backlog', 'on hold'],
    ['todo', 'new'],
    ['in_progress', 'open'],
    ['in_review', 'open'],
    ['done', 'resolved'],
    ['cancelled', 'closed'],
  ])('gitpm %s → %s', (status, state) => {
    expect(statusToBbState(status)).toBe(state);
  });

  it('applies overrides in both directions', () => {
    const config = { status_mapping: { open: 'in_progress' as const } };
    expect(bbStateToStatus('open', config)).toBe('in_progress');
    expect(bbStateToStatus('new', config)).toBe('todo');
    expect(statusToBbState('in_progress', config)).toBe('open');
  });

  it('keeps the current state when it already maps to the status', () => {
    expect(statusToBbState('cancelled', undefined, 'duplicate')).toBe(
      'duplicate',
    );
    expect(statusToBbState('done', undefined, 'duplicate')).toBe('resolved');
  });
});

describe('priority mapping', () => {
  it.each<[BbIssuePriority, Priority]>([
    ['trivial', 'low'],
    ['minor', 'low'],
    ['major', 'medium'],
    ['critical', 'high'],
    ['blocker', 'critical'],
  ])('Bitbucket %s → %s', (bb, priority) => {
    expect(bbPriorityToPriority(bb)).toBe(priority);
  });

  it.each<[Priority, BbIssuePriority]>([
    ['low', 'minor'],
    ['medium', 'major'],
    ['high', 'critical'],
    ['critical', 'blocker'],
  ])('gitpm %s → %s', (priority, bb) => {
    expect(priorityToBbPriority(priority)).toBe(bb);
  });

  it('applies overrides and keeps the current priority', () => {
    const config = { priority_mapping: { trivial: 'medium' as const } };
    expect(bbPriorityToPriority('trivial', config)).toBe('medium');
    expect(priorityToBbPriority('medium', config)).toBe('trivial');
    expect(priorityToBbPriority('low', undefined, 'trivial')).toBe('trivial');
  });
});

describe('kind mapping', () => {
  it.each<[BbIssueKind, string]>([
    ['bug', 'kind:bug'],
    ['enhancement', 'kind:enhancement'],
    ['proposal', 'kind:proposal'],
    ['task', 'kind:task'],
  ])('Bitbucket %s ↔ label %s', (kind, label) => {
    expect(bbKindToLabel(kind)).toBe(label);
    expect(labelsToBbKind(['ui', label])).toEqual({ kind, labels: ['ui'] });
  });

  it('defaults to task when no kind label is present', () => {
    expect(labelsToBbKind(['ui'])).toEqual({ kind: 'task', labels: ['ui'] });
  });

  it('takes the first kind label and drops the rest', () => {
    expect(labelsToBbKind(['kind:proposal', 'x', 'kind:bug'])).toEqual({
      kind: 'proposal',
      labels: ['x'],
    });
  });

  it('applies overrides in both directions', () => {
    const config = { kind_mapping: { bug: 'bug' } };
    expect(bbKindToLabel('bug', config)).toBe('bug');
    expect(labelsToBbKind(['bug'], config)).toEqual({
      kind: 'bug',
      labels: [],
    });
    expect(labelsToBbKind(['kind:bug'], config).kind).toBe('task');
  });
});

describe('epic marker', () => {
  it('formats, extracts and strips the marker', () => {
    const body = `Intro\n\n${epicMarker('ep-1')}`;
    expect(epicMarker('ep-1')).toBe('<!-- gitpm:epic=ep-1 -->');
    expect(extractEpicMarker(body)).toBe('ep-1');
    expect(stripEpicMarker(body)).toBe('Intro');
    expect(extractEpicMarker('no marker')).toBeNull();
  });

  it('keeps paragraphs around a marker in the middle', () => {
    expect(stripEpicMarker('a\n<!-- gitpm:epic=x -->\nb')).toBe('a\n\nb');
  });

  it('accepts the compact marker form and strips repeated markers', () => {
    expect(extractEpicMarker('<!--gitpm:epic=a_B-1-->')).toBe('a_B-1');
    expect(
      stripEpicMarker(`x\n${epicMarker('a')}\n\n${epicMarker('b')}\ny`),
    ).toBe('x\n\ny');
  });

  it('stays fast on adversarial bodies', () => {
    // ~100k chars each, shaped after the CodeQL js/polynomial-redos report.
    const newlines = `${'\n'.repeat(100_000)}x`;
    const prefixes = `<!--gitpm:epic=${'<!--gitpm:epic=!'.repeat(6_250)}`;
    const longId = `<!-- gitpm:epic=${'a'.repeat(100_000)}`;
    const start = performance.now();
    expect(stripEpicMarker(newlines)).toBe('x');
    expect(extractEpicMarker(prefixes)).toBeNull();
    expect(stripEpicMarker(prefixes)).toBe(prefixes);
    expect(extractEpicMarker(longId)).toBeNull();
    expect(withEpicMarker(longId, 'ep-1')).toContain(epicMarker('ep-1'));
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('ignores ids longer than 64 chars', () => {
    expect(extractEpicMarker(epicMarker('a'.repeat(64)))).toBe('a'.repeat(64));
    expect(extractEpicMarker(epicMarker('a'.repeat(65)))).toBeNull();
  });

  it('replaces an existing marker instead of appending', () => {
    const body = withEpicMarker(withEpicMarker('Body', 'ep-1'), 'ep-2');
    expect(body).toBe('Body\n\n<!-- gitpm:epic=ep-2 -->');
    expect(withEpicMarker(body, null)).toBe('Body');
    expect(withEpicMarker('', 'ep-3')).toBe('<!-- gitpm:epic=ep-3 -->');
  });
});

describe('epic linkage', () => {
  const epic = { id: 'ep-1', title: 'Checkout' };
  const components = new Map([['Checkout', 'ep-1']]);

  it('writes component and marker with both', () => {
    expect(epicToBbLink('Body', epic, 'both')).toEqual({
      body: `Body\n\n${epicMarker('ep-1')}`,
      component: { name: 'Checkout' },
    });
  });

  it('writes only the component with component', () => {
    expect(
      epicToBbLink(`Body\n\n${epicMarker('old')}`, epic, 'component'),
    ).toEqual({ body: 'Body', component: { name: 'Checkout' } });
  });

  it('writes only the marker with body-marker', () => {
    expect(epicToBbLink('Body', epic, 'body-marker')).toEqual({
      body: `Body\n\n${epicMarker('ep-1')}`,
      component: null,
    });
  });

  it('clears the link when there is no epic', () => {
    expect(epicToBbLink(`Body\n\n${epicMarker('ep-1')}`, null)).toEqual({
      body: 'Body',
      component: null,
    });
  });

  it('prefers the marker over the component with both', () => {
    const bb = issue({
      content: { raw: `x\n\n${epicMarker('ep-9')}` },
      component: { name: 'Checkout' },
    });
    expect(bbIssueToEpicId(bb, components, 'both')).toBe('ep-9');
    expect(bbIssueToEpicId(bb, components, 'component')).toBe('ep-1');
    expect(bbIssueToEpicId(bb, components, 'body-marker')).toBe('ep-9');
  });

  it('falls back to the component when there is no marker', () => {
    const bb = issue({ component: { name: 'Checkout' } });
    expect(bbIssueToEpicId(bb, components)).toBe('ep-1');
    expect(bbIssueToEpicId(bb, components, 'body-marker')).toBeNull();
    expect(
      bbIssueToEpicId(issue({ component: { name: 'Other' } }), components),
    ).toBeNull();
  });
});

describe('bbIssueToFields', () => {
  it('maps every field and strips the marker', () => {
    const fields = bbIssueToFields(
      issue({
        state: 'resolved',
        priority: 'blocker',
        kind: 'enhancement',
        assignee: { display_name: 'Ada L', nickname: 'ada' },
        content: { raw: `Done it\n\n${epicMarker('ep-1')}` },
      }),
    );
    expect(fields).toEqual({
      title: 'Fix login',
      status: 'done',
      priority: 'critical',
      labels: ['kind:enhancement'],
      assignee: 'ada',
      body: 'Done it',
      epicId: 'ep-1',
    });
  });

  it('falls back to display_name and empty content', () => {
    const fields = bbIssueToFields(
      issue({
        assignee: { display_name: 'Ada L' },
        content: { raw: '' },
      }),
    );
    expect(fields.assignee).toBe('Ada L');
    expect(fields.body).toBe('');
    expect(fields.epicId).toBeNull();
  });
});

describe('entityToBbIssue', () => {
  it('maps a story with its epic', () => {
    const params = entityToBbIssue(
      story({
        status: 'in_progress',
        priority: 'high',
        labels: ['kind:bug', 'ui'],
      }),
      undefined,
      { id: 'ep-1', title: 'Checkout' },
    );
    expect(params).toEqual({
      title: 'Fix login',
      content: { raw: `Steps to reproduce\n\n${epicMarker('ep-1')}` },
      kind: 'bug',
      priority: 'critical',
      state: 'open',
      component: { name: 'Checkout' },
    });
  });

  it('preserves the current remote state and priority', () => {
    const params = entityToBbIssue(
      story({ status: 'cancelled', priority: 'low' }),
      undefined,
      null,
      { state: 'wontfix', priority: 'trivial' },
    );
    expect(params.state).toBe('wontfix');
    expect(params.priority).toBe('trivial');
    expect(params.component).toBeNull();
  });

  it('maps an epic', () => {
    const epic: Epic = {
      type: 'epic',
      id: 'ep-1',
      title: 'Checkout',
      status: 'backlog',
      priority: 'medium',
      owner: null,
      labels: ['kind:proposal'],
      milestone_ref: null,
      body: '',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      filePath: '.meta/epics/checkout/epic.md',
    };
    const params = entityToBbIssue(epic, { epic_linkage: 'component' });
    expect(params.kind).toBe('proposal');
    expect(params.state).toBe('on hold');
    expect(params.content).toEqual({ raw: '' });
  });
});
