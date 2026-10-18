import { describe, expect, it } from 'vitest';
import importIssues from '../__fixtures__/import-issues.json';
import {
  buildComponentIndex,
  classifyIssues,
  resolveStoryEpic,
} from '../linker.js';
import { epicMarker } from '../mapper.js';
import type { BbIssue } from '../types.js';

const issues = importIssues as BbIssue[];
const issue = (id: number): BbIssue => {
  const found = issues.find((i) => i.id === id);
  if (!found) throw new Error(`No fixture issue ${id}`);
  return found;
};

describe('classifyIssues', () => {
  it('detects epics by [Epic] prefix and by component-named title', () => {
    expect([...classifyIssues(issues, new Map(), 'both')].sort()).toEqual([
      1, 2,
    ]);
  });

  it('ignores component names with body-marker linkage', () => {
    expect([...classifyIssues(issues, new Map(), 'body-marker')]).toEqual([1]);
  });

  it('lets known types from earlier imports win', () => {
    const known = new Map([
      [1, 'story' as const],
      [5, 'epic' as const],
    ]);
    expect([...classifyIssues(issues, known, 'both')].sort()).toEqual([2, 5]);
  });
});

describe('buildComponentIndex', () => {
  it('prefers a component named after an epic title over an epic component', () => {
    const index = buildComponentIndex([
      { issue: { ...issue(1), component: { name: 'Payments' } }, epicId: 'a' },
      { issue: issue(2), epicId: 'b' },
    ]);
    expect(index.get('Payments')).toBe('b');
    expect(index.get('[Epic] Checkout redesign')).toBe('a');
  });

  it('indexes the component an epic issue carries', () => {
    const index = buildComponentIndex([{ issue: issue(1), epicId: 'a' }]);
    expect(index.get('checkout')).toBe('a');
  });
});

describe('resolveStoryEpic', () => {
  const index = new Map([['checkout', 'ep_component']]);
  const known = new Set(['ep_component', 'ep_marker']);
  const story = (raw: string): Pick<BbIssue, 'content' | 'component'> => ({
    content: { raw },
    component: { name: 'checkout' },
  });

  it('prefers a known marker with both', () => {
    expect(
      resolveStoryEpic(story(epicMarker('ep_marker')), index, known, 'both'),
    ).toBe('ep_marker');
  });

  it('falls back to the component for an unknown marker', () => {
    expect(
      resolveStoryEpic(story(epicMarker('ghost')), index, known, 'both'),
    ).toBe('ep_component');
  });

  it('uses only the marker with body-marker', () => {
    expect(resolveStoryEpic(story(''), index, known, 'body-marker')).toBeNull();
  });

  it('ignores the marker with component', () => {
    expect(
      resolveStoryEpic(
        story(epicMarker('ep_marker')),
        index,
        known,
        'component',
      ),
    ).toBe('ep_component');
  });
});
