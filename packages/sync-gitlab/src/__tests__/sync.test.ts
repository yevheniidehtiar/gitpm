import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Epic, Milestone, Roadmap, Story } from '@gitpm/core';
import { parseTree, writeFile } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GlIssue, GlMilestone } from '../client.js';
import { saveConfig } from '../config.js';
import { remoteIssueFields, remoteMilestoneFields } from '../diff.js';
import { computeContentHash, saveState } from '../state.js';
import { syncWithGitLab } from '../sync.js';
import type { SyncState } from '../types.js';

interface FakeClient {
  getMilestone: ReturnType<typeof vi.fn>;
  getIssue: ReturnType<typeof vi.fn>;
  updateMilestone: ReturnType<typeof vi.fn>;
  updateIssue: ReturnType<typeof vi.fn>;
  createMilestone: ReturnType<typeof vi.fn>;
  createIssue: ReturnType<typeof vi.fn>;
}

const fake: FakeClient = {
  getMilestone: vi.fn(),
  getIssue: vi.fn(),
  updateMilestone: vi.fn(),
  updateIssue: vi.fn(),
  createMilestone: vi.fn(),
  createIssue: vi.fn(),
};

vi.mock('../client.js', () => ({
  GitLabClient: vi.fn().mockImplementation(function () {
    return fake;
  }),
}));

let metaDir: string;

beforeEach(async () => {
  metaDir = await mkdtemp(join(tmpdir(), 'gitpm-sync-'));
  for (const f of Object.values(fake)) f.mockReset();
});

afterEach(async () => {
  await rm(metaDir, { recursive: true });
});

async function writeMeta(entity: {
  filePath: string;
  [k: string]: unknown;
}): Promise<void> {
  const resolved = join(metaDir, entity.filePath.replace(/^\.meta\//, ''));
  await mkdir(join(resolved, '..'), { recursive: true });
  const result = await writeFile(entity as never, resolved);
  if (!result.ok) throw result.error;
}

function makeRoadmap(milestones: { id: string }[] = []): Roadmap {
  return {
    type: 'roadmap',
    id: 'r1',
    title: 'Roadmap',
    description: '',
    milestones,
    updated_at: '2026-01-01T00:00:00Z',
    filePath: '.meta/roadmap/roadmap.yaml',
  };
}

function makeMilestone(id: string, overrides?: Partial<Milestone>): Milestone {
  return {
    type: 'milestone',
    id,
    title: `Milestone ${id}`,
    status: 'in_progress',
    body: 'desc',
    filePath: `.meta/roadmap/milestones/${id}.md`,
    ...overrides,
  } as Milestone;
}

function makeEpic(id: string, overrides?: Partial<Epic>): Epic {
  return {
    type: 'epic',
    id,
    title: `Epic ${id}`,
    status: 'todo',
    priority: 'medium',
    owner: null,
    labels: [],
    milestone_ref: null,
    body: 'epic body',
    filePath: `.meta/epics/${id}/epic.md`,
    ...overrides,
  } as Epic;
}

function makeStory(id: string, overrides?: Partial<Story>): Story {
  return {
    type: 'story',
    id,
    title: `Story ${id}`,
    status: 'todo',
    priority: 'medium',
    assignee: null,
    labels: [],
    estimate: null,
    epic_ref: null,
    body: 'story body',
    filePath: `.meta/stories/${id}.md`,
    ...overrides,
  } as Story;
}

function makeGlMilestone(overrides: Partial<GlMilestone>): GlMilestone {
  return {
    id: 1,
    iid: 1,
    title: 't',
    description: null,
    state: 'active',
    due_date: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeGlIssue(overrides: Partial<GlIssue>): GlIssue {
  return {
    id: 1,
    iid: 1,
    title: 't',
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

function remoteMilestoneHash(gl: GlMilestone): string {
  const fields = remoteMilestoneFields(gl);
  return `sha256:${createHash('sha256').update(JSON.stringify(fields)).digest('hex')}`;
}

function remoteIssueHash(gl: GlIssue): string {
  const fields = remoteIssueFields(gl);
  return `sha256:${createHash('sha256').update(JSON.stringify(fields)).digest('hex')}`;
}

async function seedConfig(): Promise<void> {
  await saveConfig(metaDir, {
    project: 'ns/proj',
    project_id: 42,
    base_url: 'https://gitlab.com',
    status_mapping: {},
    label_mapping: { epic_labels: ['epic'] },
    auto_sync: false,
  });
}

describe('syncWithGitLab', () => {
  it('errors when config missing', async () => {
    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(false);
  });

  it('errors when state missing', async () => {
    await seedConfig();
    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/No sync state/);
  });

  it('closes remote when entity deleted locally', async () => {
    await seedConfig();
    await writeMeta(makeRoadmap());

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        gone: {
          gitlab_issue_iid: 9,
          gitlab_milestone_id: 10,
          local_hash: 'sha256:x',
          remote_hash: 'sha256:x',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.updateIssue.mockResolvedValue(makeGlIssue({ state: 'closed' }));
    fake.updateMilestone.mockResolvedValue(
      makeGlMilestone({ state: 'closed' }),
    );

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    expect(fake.updateIssue).toHaveBeenCalledWith(
      42,
      9,
      expect.objectContaining({ state_event: 'close' }),
    );
    expect(fake.updateMilestone).toHaveBeenCalledWith(
      42,
      10,
      expect.objectContaining({ state_event: 'close' }),
    );
  });

  it('marks milestone cancelled when remote deleted', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    const parsed = await parseTree(metaDir);
    if (!parsed.ok) throw parsed.error;
    const msFromDisk = parsed.value.milestones[0];
    const h = computeContentHash(msFromDisk);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        m1: {
          gitlab_milestone_id: 101,
          local_hash: h,
          remote_hash: h,
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getMilestone.mockResolvedValueOnce(null);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.milestones).toBe(1);
  });

  it('marks story cancelled when remote issue deleted', async () => {
    await seedConfig();
    const story = makeStory('s1');
    await writeMeta(makeRoadmap());
    await writeMeta(story);

    const parsed = await parseTree(metaDir);
    if (!parsed.ok) throw parsed.error;
    const h = computeContentHash(parsed.value.stories[0]);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        s1: {
          gitlab_issue_iid: 50,
          local_hash: h,
          remote_hash: h,
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getIssue.mockResolvedValueOnce(null);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.issues).toBe(1);
  });

  it('pushes local milestone changes when only local changed', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    // State's local_hash differs from the entity (local changed)
    // State's remote_hash matches getMilestone response (remote unchanged)
    const remoteMs = makeGlMilestone({
      id: 101,
      title: 'Milestone m1',
      description: 'desc',
      state: 'active',
    });
    const rh = remoteMilestoneHash(remoteMs);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        m1: {
          gitlab_milestone_id: 101,
          local_hash: 'sha256:stale-local',
          remote_hash: rh,
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getMilestone.mockResolvedValueOnce(remoteMs);
    fake.updateMilestone.mockResolvedValueOnce(remoteMs);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.milestones).toBe(1);
    expect(fake.updateMilestone).toHaveBeenCalled();
  });

  it('pulls remote milestone when only remote changed', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    const parsed = await parseTree(metaDir);
    if (!parsed.ok) throw parsed.error;
    const lh = computeContentHash(parsed.value.milestones[0]);

    const remoteMs = makeGlMilestone({
      id: 101,
      title: 'Updated Remote Title',
      description: 'new',
      state: 'closed',
    });

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        m1: {
          gitlab_milestone_id: 101,
          local_hash: lh,
          remote_hash: 'sha256:stale-remote',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getMilestone.mockResolvedValueOnce(remoteMs);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.milestones).toBe(1);
  });

  it('conflicts with local-wins strategy pushes local', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    const remoteMs = makeGlMilestone({
      id: 101,
      title: 'Different Remote',
      state: 'active',
    });

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        m1: {
          gitlab_milestone_id: 101,
          local_hash: 'sha256:stale-local',
          remote_hash: 'sha256:stale-remote',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getMilestone.mockResolvedValueOnce(remoteMs);
    fake.updateMilestone.mockResolvedValue(remoteMs);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resolved).toBe(1);
    expect(fake.updateMilestone).toHaveBeenCalled();
  });

  it('conflicts with remote-wins strategy pulls remote', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    const remoteMs = makeGlMilestone({
      id: 101,
      title: 'Different Remote',
      state: 'active',
    });

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        m1: {
          gitlab_milestone_id: 101,
          local_hash: 'sha256:stale-local',
          remote_hash: 'sha256:stale-remote',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getMilestone.mockResolvedValueOnce(remoteMs);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
      strategy: 'remote-wins',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resolved).toBe(1);
  });

  it('conflicts with ask strategy records unresolved', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    const remoteMs = makeGlMilestone({
      id: 101,
      title: 'Different Remote',
    });

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        m1: {
          gitlab_milestone_id: 101,
          local_hash: 'sha256:stale-local',
          remote_hash: 'sha256:stale-remote',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getMilestone.mockResolvedValueOnce(remoteMs);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
      strategy: 'ask',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conflicts.length).toBe(1);
    expect(result.value.skipped).toBe(1);
  });

  it('pushes local issue when local changed', async () => {
    await seedConfig();
    const story = makeStory('s1');
    await writeMeta(makeRoadmap());
    await writeMeta(story);

    const remoteIssue = makeGlIssue({
      iid: 50,
      title: 'Story s1',
      description: 'story body',
      state: 'opened',
    });
    const rh = remoteIssueHash(remoteIssue);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        s1: {
          gitlab_issue_iid: 50,
          local_hash: 'sha256:stale-local',
          remote_hash: rh,
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getIssue.mockResolvedValueOnce(remoteIssue);
    fake.updateIssue.mockResolvedValueOnce(remoteIssue);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBe(1);
  });

  it('pulls remote issue when remote changed', async () => {
    await seedConfig();
    const story = makeStory('s1');
    await writeMeta(makeRoadmap());
    await writeMeta(story);

    const parsed = await parseTree(metaDir);
    if (!parsed.ok) throw parsed.error;
    const lh = computeContentHash(parsed.value.stories[0]);

    const remoteIssue = makeGlIssue({
      iid: 50,
      title: 'Remote Updated',
      description: 'changed',
      state: 'closed',
    });

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        s1: {
          gitlab_issue_iid: 50,
          local_hash: lh,
          remote_hash: 'sha256:stale-remote',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getIssue.mockResolvedValueOnce(remoteIssue);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.issues).toBe(1);
  });

  it('issue conflict with local-wins pushes local', async () => {
    await seedConfig();
    const story = makeStory('s1');
    await writeMeta(makeRoadmap());
    await writeMeta(story);

    const remoteIssue = makeGlIssue({ iid: 50, title: 'Remote' });

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        s1: {
          gitlab_issue_iid: 50,
          local_hash: 'sha256:stale-local',
          remote_hash: 'sha256:stale-remote',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getIssue.mockResolvedValueOnce(remoteIssue);
    fake.updateIssue.mockResolvedValue(remoteIssue);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
      strategy: 'local-wins',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resolved).toBe(1);
    expect(fake.updateIssue).toHaveBeenCalled();
  });

  it('issue conflict with remote-wins pulls remote', async () => {
    await seedConfig();
    const story = makeStory('s1');
    await writeMeta(makeRoadmap());
    await writeMeta(story);

    const remoteIssue = makeGlIssue({
      iid: 50,
      title: 'Remote',
      description: 'remote body',
    });

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        s1: {
          gitlab_issue_iid: 50,
          local_hash: 'sha256:stale-local',
          remote_hash: 'sha256:stale-remote',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getIssue.mockResolvedValueOnce(remoteIssue);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
      strategy: 'remote-wins',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resolved).toBe(1);
  });

  it('issue conflict with ask adds to conflicts', async () => {
    await seedConfig();
    const story = makeStory('s1');
    await writeMeta(makeRoadmap());
    await writeMeta(story);

    const remoteIssue = makeGlIssue({ iid: 50, title: 'Remote' });

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        s1: {
          gitlab_issue_iid: 50,
          local_hash: 'sha256:stale-local',
          remote_hash: 'sha256:stale-remote',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getIssue.mockResolvedValueOnce(remoteIssue);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
      strategy: 'ask',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conflicts.length).toBe(1);
  });

  it('creates new milestone on GitLab when not in state', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {},
    } satisfies SyncState);
    fake.createMilestone.mockResolvedValueOnce(makeGlMilestone({ id: 200 }));

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.milestones).toBe(1);
    expect(fake.createMilestone).toHaveBeenCalled();
  });

  it('creates new issue on GitLab and closes if done', async () => {
    await seedConfig();
    const story = makeStory('s1', { status: 'done' });
    await writeMeta(makeRoadmap());
    await writeMeta(story);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {},
    });
    fake.createIssue.mockResolvedValueOnce(makeGlIssue({ iid: 77 }));
    fake.updateIssue.mockResolvedValueOnce(makeGlIssue({ iid: 77 }));

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBe(1);
    expect(fake.createIssue).toHaveBeenCalled();
    expect(fake.updateIssue).toHaveBeenCalledWith(
      42,
      77,
      expect.objectContaining({ state_event: 'close' }),
    );
  });

  it('dryRun does not call mutation APIs', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {},
    });
    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
      dryRun: true,
    });
    expect(result.ok).toBe(true);
    expect(fake.createMilestone).not.toHaveBeenCalled();
  });

  it('skips entities already in sync', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    const parsed = await parseTree(metaDir);
    if (!parsed.ok) throw parsed.error;
    const lh = computeContentHash(parsed.value.milestones[0]);

    const remoteMs = makeGlMilestone({
      id: 101,
      title: 'Milestone m1',
      description: 'desc',
      state: 'active',
    });
    const rh = remoteMilestoneHash(remoteMs);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        m1: {
          gitlab_milestone_id: 101,
          local_hash: lh,
          remote_hash: rh,
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getMilestone.mockResolvedValueOnce(remoteMs);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.milestones).toBe(0);
    expect(result.value.pulled.milestones).toBe(0);
    expect(fake.updateMilestone).not.toHaveBeenCalled();
  });

  it('creates new epic on GitLab when not in state', async () => {
    await seedConfig();
    const epic = makeEpic('e1');
    await writeMeta(makeRoadmap());
    await writeMeta(epic);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {},
    });
    fake.createIssue.mockResolvedValueOnce(makeGlIssue({ iid: 30 }));

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pushed.issues).toBe(1);
    expect(fake.createIssue).toHaveBeenCalled();
  });

  it('pulls epic issue (sets owner) when remote changed', async () => {
    await seedConfig();
    const epic = makeEpic('e1');
    await writeMeta(makeRoadmap());
    await writeMeta(epic);

    const parsed = await parseTree(metaDir);
    if (!parsed.ok) throw parsed.error;
    const lh = computeContentHash(parsed.value.epics[0]);

    const remoteIssue = makeGlIssue({
      iid: 50,
      title: 'Remote Epic',
      description: 'remote body',
      assignee: { id: 1, username: 'alice' },
      labels: ['epic', 'platform'],
    });

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        e1: {
          gitlab_issue_iid: 50,
          local_hash: lh,
          remote_hash: 'sha256:stale',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    fake.getIssue.mockResolvedValueOnce(remoteIssue);

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pulled.issues).toBe(1);
  });

  it('returns error Result when client throws', async () => {
    await seedConfig();
    await writeMeta(makeRoadmap());
    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        s1: {
          gitlab_issue_iid: 1,
          local_hash: 'a',
          remote_hash: 'b',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    // entity is "locally deleted" but we want the update to throw
    fake.updateIssue.mockRejectedValueOnce(new Error('boom'));

    const result = await syncWithGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/boom/);
  });
});
