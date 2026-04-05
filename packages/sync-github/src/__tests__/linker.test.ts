import type { Epic, Story } from '@gitpm/core';
import { describe, expect, it } from 'vitest';
import type { GhIssue } from '../client.js';
import type { LinkContext } from '../linker.js';
import { resolveEpicLink } from '../linker.js';

function makeEpic(id: string, title: string): Epic {
  return {
    type: 'epic',
    id,
    title,
    status: 'todo',
    priority: 'medium',
    owner: null,
    labels: [],
    milestone_ref: null,
    github: null,
    body: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    filePath: '',
  };
}

function makeStory(id: string, title: string): Story {
  return {
    type: 'story',
    id,
    title,
    status: 'todo',
    priority: 'medium',
    assignee: null,
    labels: [],
    estimate: null,
    epic_ref: null,
    github: null,
    body: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    filePath: '',
  };
}

function makeGhIssue(
  overrides: Partial<GhIssue> & { number: number },
): GhIssue {
  return {
    title: `Issue ${overrides.number}`,
    body: null,
    state: 'open',
    assignee: null,
    labels: [],
    milestone: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('resolveEpicLink', () => {
  describe('body-refs strategy', () => {
    it('links story to epic when body references epic number', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghStory = makeGhIssue({ number: 2, body: 'Part of #1' });
      const ghEpic = makeGhIssue({
        number: 1,
        labels: [{ name: 'epic' }],
      });

      const ctx: LinkContext = {
        ghIssues: [ghEpic, ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [2, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map(),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'body-refs');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic1');
    });

    it('returns null when body has no epic references', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghStory = makeGhIssue({ number: 2, body: 'No references here' });

      const ctx: LinkContext = {
        ghIssues: [makeGhIssue({ number: 1 }), ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [2, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map(),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'body-refs');
      expect(result).toBeNull();
    });

    it('returns null when body is null', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghStory = makeGhIssue({ number: 2 });

      const ctx: LinkContext = {
        ghIssues: [makeGhIssue({ number: 1 }), ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [2, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map(),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'body-refs');
      expect(result).toBeNull();
    });
  });

  describe('sub-issues strategy', () => {
    it('links story when it is a sub-issue of an epic', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghStory = makeGhIssue({ number: 5 });

      const ctx: LinkContext = {
        ghIssues: [makeGhIssue({ number: 1 }), ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [5, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map([[1, [5, 6, 7]]]),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'sub-issues');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic1');
    });

    it('returns null when story is not a sub-issue', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghStory = makeGhIssue({ number: 10 });

      const ctx: LinkContext = {
        ghIssues: [makeGhIssue({ number: 1 }), ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [10, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map([[1, [5, 6, 7]]]),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'sub-issues');
      expect(result).toBeNull();
    });
  });

  describe('milestone strategy', () => {
    it('links story to epic when they share exactly one milestone', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghEpic = makeGhIssue({
        number: 1,
        labels: [{ name: 'epic' }],
        milestone: { number: 1, title: 'Sprint 1' },
      });
      const ghStory = makeGhIssue({
        number: 2,
        milestone: { number: 1, title: 'Sprint 1' },
      });

      const ctx: LinkContext = {
        ghIssues: [ghEpic, ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [2, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map(),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'milestone');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic1');
    });

    it('returns null when multiple epics share the same milestone', () => {
      const epic1 = makeEpic('epic1', 'Epic One');
      const epic2 = makeEpic('epic2', 'Epic Two');
      const story = makeStory('story1', 'My Story');
      const ghEpic1 = makeGhIssue({
        number: 1,
        milestone: { number: 1, title: 'Sprint 1' },
      });
      const ghEpic2 = makeGhIssue({
        number: 2,
        milestone: { number: 1, title: 'Sprint 1' },
      });
      const ghStory = makeGhIssue({
        number: 3,
        milestone: { number: 1, title: 'Sprint 1' },
      });

      const ctx: LinkContext = {
        ghIssues: [ghEpic1, ghEpic2, ghStory],
        issueNumberToEntity: new Map([
          [1, epic1],
          [2, epic2],
          [3, story],
        ]),
        epicIssueNumberToEpic: new Map([
          [1, epic1],
          [2, epic2],
        ]),
        epicSubIssues: new Map(),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'milestone');
      expect(result).toBeNull();
    });

    it('returns null when story has no milestone', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghStory = makeGhIssue({ number: 2 });

      const ctx: LinkContext = {
        ghIssues: [
          makeGhIssue({
            number: 1,
            milestone: { number: 1, title: 'Sprint 1' },
          }),
          ghStory,
        ],
        issueNumberToEntity: new Map([
          [1, epic],
          [2, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map(),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'milestone');
      expect(result).toBeNull();
    });
  });

  describe('labels strategy', () => {
    it('links story to epic when they share labels (excluding epic label)', () => {
      const epic = makeEpic('epic1', 'Backend Epic');
      const story = makeStory('story1', 'Backend Story');
      const ghEpic = makeGhIssue({
        number: 1,
        labels: [{ name: 'epic' }, { name: 'backend' }],
      });
      const ghStory = makeGhIssue({
        number: 2,
        labels: [{ name: 'backend' }, { name: 'priority:high' }],
      });

      const ctx: LinkContext = {
        ghIssues: [ghEpic, ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [2, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map(),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'labels');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic1');
    });

    it('returns null when multiple epics share labels with story', () => {
      const epic1 = makeEpic('epic1', 'Epic One');
      const epic2 = makeEpic('epic2', 'Epic Two');
      const story = makeStory('story1', 'My Story');
      const ghEpic1 = makeGhIssue({
        number: 1,
        labels: [{ name: 'epic' }, { name: 'backend' }],
      });
      const ghEpic2 = makeGhIssue({
        number: 2,
        labels: [{ name: 'epic' }, { name: 'backend' }],
      });
      const ghStory = makeGhIssue({
        number: 3,
        labels: [{ name: 'backend' }],
      });

      const ctx: LinkContext = {
        ghIssues: [ghEpic1, ghEpic2, ghStory],
        issueNumberToEntity: new Map([
          [1, epic1],
          [2, epic2],
          [3, story],
        ]),
        epicIssueNumberToEpic: new Map([
          [1, epic1],
          [2, epic2],
        ]),
        epicSubIssues: new Map(),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'labels');
      expect(result).toBeNull();
    });

    it('returns null when story has no labels', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghStory = makeGhIssue({ number: 2 });

      const ctx: LinkContext = {
        ghIssues: [
          makeGhIssue({
            number: 1,
            labels: [{ name: 'epic' }, { name: 'backend' }],
          }),
          ghStory,
        ],
        issueNumberToEntity: new Map([
          [1, epic],
          [2, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map(),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'labels');
      expect(result).toBeNull();
    });
  });

  describe('all strategy (fallback chain)', () => {
    it('uses body-refs first when available', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghStory = makeGhIssue({ number: 2, body: 'Part of #1' });
      const ghEpic = makeGhIssue({
        number: 1,
        labels: [{ name: 'epic' }],
      });

      const ctx: LinkContext = {
        ghIssues: [ghEpic, ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [2, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map(),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'all');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic1');
    });

    it('falls back to sub-issues when body-refs fail', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghStory = makeGhIssue({ number: 5, body: 'No refs here' });

      const ctx: LinkContext = {
        ghIssues: [makeGhIssue({ number: 1 }), ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [5, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map([[1, [5]]]),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'all');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic1');
    });

    it('falls back to milestone when body-refs and sub-issues fail', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghEpic = makeGhIssue({
        number: 1,
        milestone: { number: 1, title: 'Sprint 1' },
      });
      const ghStory = makeGhIssue({
        number: 5,
        body: 'No refs here',
        milestone: { number: 1, title: 'Sprint 1' },
      });

      const ctx: LinkContext = {
        ghIssues: [ghEpic, ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [5, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map([[1, []]]),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'all');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic1');
    });

    it('falls back to labels as last resort', () => {
      const epic = makeEpic('epic1', 'Backend Epic');
      const story = makeStory('story1', 'My Story');
      const ghEpic = makeGhIssue({
        number: 1,
        labels: [{ name: 'epic' }, { name: 'backend' }],
      });
      const ghStory = makeGhIssue({
        number: 5,
        labels: [{ name: 'backend' }],
      });

      const ctx: LinkContext = {
        ghIssues: [ghEpic, ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [5, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map([[1, []]]),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'all');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic1');
    });

    it('returns null when no strategy matches', () => {
      const epic = makeEpic('epic1', 'My Epic');
      const story = makeStory('story1', 'My Story');
      const ghStory = makeGhIssue({ number: 5 });

      const ctx: LinkContext = {
        ghIssues: [makeGhIssue({ number: 1 }), ghStory],
        issueNumberToEntity: new Map([
          [1, epic],
          [5, story],
        ]),
        epicIssueNumberToEpic: new Map([[1, epic]]),
        epicSubIssues: new Map([[1, []]]),
      };

      const result = resolveEpicLink(ghStory, story, ctx, 'all');
      expect(result).toBeNull();
    });
  });
});
