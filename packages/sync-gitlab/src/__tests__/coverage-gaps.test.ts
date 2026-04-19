import { writeFile as fsWriteFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Epic, Prd, Story } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GlIssue } from '../client.js';
import { saveConfig } from '../config.js';
import type { LinkContext } from '../linker.js';
import { resolveEpicLink } from '../linker.js';
import { computeContentHash, createInitialState, saveState } from '../state.js';
import type { SyncState } from '../types.js';

let metaDir: string;

beforeEach(async () => {
  metaDir = await mkdtemp(join(tmpdir(), 'gitpm-gaps-'));
});

afterEach(async () => {
  await rm(metaDir, { recursive: true });
});

describe('config.saveConfig error path', () => {
  it('returns error when path is unwritable', async () => {
    // Pass a metaDir with an invalid nested path — use a file-as-directory trick:
    const filePath = join(metaDir, 'blocker');
    await fsWriteFile(filePath, '', 'utf-8');
    // metaDir/blocker is a file; sync would be blocker/sync/gitlab-config.yaml
    const result = await saveConfig(join(filePath, 'inner'), {
      project: 'ns/p',
      project_id: 1,
      base_url: 'https://gitlab.com',
      status_mapping: {},
      label_mapping: { epic_labels: [] },
      auto_sync: false,
    });
    expect(result.ok).toBe(false);
  });
});

describe('state error paths and branches', () => {
  it('saveState returns error when path invalid', async () => {
    const filePath = join(metaDir, 'blocker');
    await fsWriteFile(filePath, '', 'utf-8');

    const result = await saveState(join(filePath, 'inner'), {
      project: 'ns/p',
      last_sync: '2026-01-01T00:00:00Z',
      entities: {},
    } satisfies SyncState);
    expect(result.ok).toBe(false);
  });

  it('computeContentHash covers prd branch', () => {
    const prd: Prd = {
      type: 'prd',
      id: 'p1',
      title: 'PRD',
      status: 'in_progress',
      body: 'content\r\ntrailing  \n',
      filePath: '.meta/prds/p1.md',
    } as Prd;
    const hash = computeContentHash(prd);
    expect(hash).toMatch(/^sha256:/);
  });

  it('createInitialState records gitlab_epic_iid for epics with epic_iid', () => {
    const epic: Epic = {
      type: 'epic',
      id: 'e1',
      title: 'Epic',
      status: 'todo',
      priority: 'medium',
      owner: null,
      labels: [],
      milestone_ref: null,
      body: '',
      filePath: '.meta/epics/e1/epic.md',
      gitlab: {
        issue_iid: 10,
        epic_iid: 5,
        project_id: 42,
        base_url: 'https://gitlab.com',
        last_sync_hash: '',
        synced_at: '2026-01-01T00:00:00Z',
      },
    } as Epic;

    const state = createInitialState('ns/p', [epic], 42);
    expect(state.entities.e1.gitlab_epic_iid).toBe(5);
    expect(state.entities.e1.gitlab_issue_iid).toBe(10);
  });

  it('createInitialState skips entities without id', () => {
    const state = createInitialState(
      'ns/p',
      [{ type: 'sprint', id: '', title: 'x' } as never],
      undefined,
    );
    expect(Object.keys(state.entities)).toHaveLength(0);
  });
});

describe('linker edge cases', () => {
  function mkEpic(id: string, title: string): Epic {
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

  function mkStory(id: string, title: string): Story {
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

  function mkIssue(overrides: Partial<GlIssue> & { iid: number }): GlIssue {
    return {
      id: overrides.iid,
      iid: overrides.iid,
      title: 'i',
      description: null,
      state: 'opened',
      assignee: null,
      labels: [],
      milestone: null,
      weight: null,
      epic_iid: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      ...overrides,
    };
  }

  it('returns null for unknown strategy (default case)', () => {
    const storyIssue = mkIssue({ iid: 1 });
    const ctx: LinkContext = {
      glIssues: [storyIssue],
      issueIidToEntity: new Map(),
      epicIssueIidToEpic: new Map(),
      nativeEpicIssueIids: new Map(),
    };
    const result = resolveEpicLink(
      storyIssue,
      mkStory('s1', 'S'),
      ctx,
      'bogus' as never,
    );
    expect(result).toBeNull();
  });

  it('native-epics strategy links via epic_iid on the issue', () => {
    const epic = mkEpic('e1', 'Epic One');
    const epicEntityWithEpicIid: Epic = {
      ...epic,
      gitlab: {
        epic_iid: 7,
        project_id: 42,
        base_url: 'https://gitlab.com',
        last_sync_hash: '',
        synced_at: '2026-01-01T00:00:00Z',
      },
    };
    const story = mkStory('s1', 'S');
    const storyIssue = mkIssue({ iid: 100, epic_iid: 7 });

    const ctx: LinkContext = {
      glIssues: [storyIssue],
      issueIidToEntity: new Map([
        [100, story],
        [200, epicEntityWithEpicIid],
      ]),
      epicIssueIidToEpic: new Map(),
      nativeEpicIssueIids: new Map(),
    };
    const result = resolveEpicLink(storyIssue, story, ctx, 'native-epics');
    expect(result).not.toBeNull();
    expect(result?.epicRef.id).toBe('e1');
    expect(result?.parentEpicSlug).toBe('epic-one');
  });

  it('milestone strategy returns null when no epic shares the milestone', () => {
    const story = mkStory('s1', 'S');
    const storyIssue = mkIssue({
      iid: 10,
      milestone: { id: 99, iid: 1, title: 'x' },
    });
    const ctx: LinkContext = {
      glIssues: [storyIssue],
      issueIidToEntity: new Map([[10, story]]),
      epicIssueIidToEpic: new Map(),
      nativeEpicIssueIids: new Map(),
    };
    const result = resolveEpicLink(storyIssue, story, ctx, 'milestone');
    expect(result).toBeNull();
  });

  it('labels strategy returns null when no shared labels', () => {
    const epic = mkEpic('e1', 'Epic');
    const epicIssue = mkIssue({ iid: 1, labels: ['epic', 'auth'] });
    const storyIssue = mkIssue({ iid: 2, labels: ['ui'] });
    const ctx: LinkContext = {
      glIssues: [epicIssue, storyIssue],
      issueIidToEntity: new Map([[2, mkStory('s', 'S')]]),
      epicIssueIidToEpic: new Map([[1, epic]]),
      nativeEpicIssueIids: new Map(),
    };
    const result = resolveEpicLink(
      storyIssue,
      mkStory('s', 'S'),
      ctx,
      'labels',
    );
    expect(result).toBeNull();
  });
});
