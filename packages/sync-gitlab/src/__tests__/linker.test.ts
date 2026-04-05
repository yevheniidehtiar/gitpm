import type { Epic, Story } from '@gitpm/core';
import { describe, expect, it } from 'vitest';
import type { GlIssue } from '../client.js';
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
    body: '',
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
    body: '',
    filePath: '',
  };
}

function makeGlIssue(overrides: Partial<GlIssue> & { iid: number }): GlIssue {
  return {
    id: overrides.iid * 100,
    iid: overrides.iid,
    title: overrides.title ?? `Issue ${overrides.iid}`,
    description: overrides.description ?? null,
    state: overrides.state ?? 'opened',
    assignee: overrides.assignee ?? null,
    labels: overrides.labels ?? [],
    milestone: overrides.milestone ?? null,
    weight: overrides.weight ?? null,
    epic_iid: overrides.epic_iid ?? null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('resolveEpicLink', () => {
  const epic = makeEpic('epic-1', 'Auth Epic');
  const story = makeStory('story-1', 'OAuth Login');

  describe('body-refs strategy', () => {
    it('finds epic ref in issue description', () => {
      const epicIssue = makeGlIssue({ iid: 10, labels: ['epic'] });
      const storyIssue = makeGlIssue({
        iid: 11,
        description: 'Related to #10',
      });

      const ctx: LinkContext = {
        glIssues: [epicIssue, storyIssue],
        issueIidToEntity: new Map([
          [10, epic],
          [11, story],
        ]),
        epicIssueIidToEpic: new Map([[10, epic]]),
        nativeEpicIssueIids: new Map(),
      };

      const result = resolveEpicLink(storyIssue, story, ctx, 'body-refs');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic-1');
      expect(result?.parentEpicSlug).toBe('auth-epic');
    });

    it('returns null when no ref found', () => {
      const storyIssue = makeGlIssue({ iid: 11, description: 'No refs here' });
      const ctx: LinkContext = {
        glIssues: [storyIssue],
        issueIidToEntity: new Map([[11, story]]),
        epicIssueIidToEpic: new Map(),
        nativeEpicIssueIids: new Map(),
      };

      const result = resolveEpicLink(storyIssue, story, ctx, 'body-refs');
      expect(result).toBeNull();
    });
  });

  describe('milestone strategy', () => {
    it('links story to epic when they share a milestone', () => {
      const milestone = { id: 101, iid: 1, title: 'v1' };
      const epicIssue = makeGlIssue({
        iid: 10,
        labels: ['epic'],
        milestone,
      });
      const storyIssue = makeGlIssue({ iid: 11, milestone });

      const ctx: LinkContext = {
        glIssues: [epicIssue, storyIssue],
        issueIidToEntity: new Map([
          [10, epic],
          [11, story],
        ]),
        epicIssueIidToEpic: new Map([[10, epic]]),
        nativeEpicIssueIids: new Map(),
      };

      const result = resolveEpicLink(storyIssue, story, ctx, 'milestone');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic-1');
    });
  });

  describe('labels strategy', () => {
    it('links story to epic when they share exactly one non-epic label', () => {
      const epicIssue = makeGlIssue({
        iid: 10,
        labels: ['epic', 'auth'],
      });
      const storyIssue = makeGlIssue({
        iid: 11,
        labels: ['auth'],
      });

      const ctx: LinkContext = {
        glIssues: [epicIssue, storyIssue],
        issueIidToEntity: new Map([
          [10, epic],
          [11, story],
        ]),
        epicIssueIidToEpic: new Map([[10, epic]]),
        nativeEpicIssueIids: new Map(),
      };

      const result = resolveEpicLink(storyIssue, story, ctx, 'labels');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic-1');
    });
  });

  describe('native-epics strategy', () => {
    it('links via nativeEpicIssueIids map', () => {
      const storyIssue = makeGlIssue({ iid: 11 });
      const epicIssue = makeGlIssue({ iid: 10, labels: ['epic'] });

      const ctx: LinkContext = {
        glIssues: [epicIssue, storyIssue],
        issueIidToEntity: new Map([
          [10, epic],
          [11, story],
        ]),
        epicIssueIidToEpic: new Map([[10, epic]]),
        nativeEpicIssueIids: new Map([[10, [11]]]),
      };

      const result = resolveEpicLink(storyIssue, story, ctx, 'native-epics');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic-1');
    });
  });

  describe('all strategy', () => {
    it('tries all strategies in order', () => {
      const epicIssue = makeGlIssue({ iid: 10, labels: ['epic', 'auth'] });
      const storyIssue = makeGlIssue({
        iid: 11,
        description: 'Related to #10',
        labels: ['auth'],
      });

      const ctx: LinkContext = {
        glIssues: [epicIssue, storyIssue],
        issueIidToEntity: new Map([
          [10, epic],
          [11, story],
        ]),
        epicIssueIidToEpic: new Map([[10, epic]]),
        nativeEpicIssueIids: new Map(),
      };

      const result = resolveEpicLink(storyIssue, story, ctx, 'all');
      expect(result).not.toBeNull();
      expect(result?.epicRef.id).toBe('epic-1');
    });
  });
});
