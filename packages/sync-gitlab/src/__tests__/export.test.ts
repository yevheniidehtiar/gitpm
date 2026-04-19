import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Epic, Milestone, Roadmap, Story } from '@gitpm/core';
import { writeFile } from '@gitpm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GlIssue, GlMilestone } from '../client.js';
import { saveConfig } from '../config.js';
import { exportToGitLab } from '../export.js';
import { computeContentHash, saveState } from '../state.js';
import type { SyncState } from '../types.js';

interface FakeClient {
  createMilestone: ReturnType<typeof vi.fn>;
  updateMilestone: ReturnType<typeof vi.fn>;
  createIssue: ReturnType<typeof vi.fn>;
  updateIssue: ReturnType<typeof vi.fn>;
}

const fake: FakeClient = {
  createMilestone: vi.fn(),
  updateMilestone: vi.fn(),
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
};

vi.mock('../client.js', () => ({
  GitLabClient: vi.fn().mockImplementation(function () {
    return fake;
  }),
}));

let metaDir: string;

beforeEach(async () => {
  metaDir = await mkdtemp(join(tmpdir(), 'gitpm-export-'));
  fake.createMilestone.mockReset();
  fake.updateMilestone.mockReset();
  fake.createIssue.mockReset();
  fake.updateIssue.mockReset();
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
    target_date: '2026-06-30',
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

describe('exportToGitLab', () => {
  it('errors when config missing', async () => {
    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.message).toMatch(/No GitLab config found/);
  });

  it('creates milestones, epics, and stories on first run', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    const epic = makeEpic('e1', { milestone_ref: { id: 'm1' } });
    const story = makeStory('s1');
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);
    await writeMeta(epic);
    await writeMeta(story);

    fake.createMilestone.mockImplementation(async () =>
      makeGlMilestone({ id: 101 }),
    );
    let issueCounter = 10;
    fake.createIssue.mockImplementation(async () =>
      makeGlIssue({ id: issueCounter, iid: issueCounter++ }),
    );
    fake.updateIssue.mockImplementation(async () => makeGlIssue({}));

    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created.milestones).toBe(1);
    expect(result.value.created.issues).toBe(2);
    expect(fake.createMilestone).toHaveBeenCalledTimes(1);
    expect(fake.createIssue).toHaveBeenCalledTimes(2);
  });

  it('dryRun does not call client mutation APIs', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
      dryRun: true,
    });
    expect(result.ok).toBe(true);
    expect(fake.createMilestone).not.toHaveBeenCalled();
  });

  it('closes issue after creation when status is done', async () => {
    await seedConfig();
    const doneStory = makeStory('s1', { status: 'done' });
    await writeMeta(makeRoadmap());
    await writeMeta(doneStory);

    fake.createIssue.mockResolvedValueOnce(makeGlIssue({ iid: 5 }));
    fake.updateIssue.mockResolvedValueOnce(makeGlIssue({ iid: 5 }));

    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    expect(fake.createIssue).toHaveBeenCalledTimes(1);
    expect(fake.updateIssue).toHaveBeenCalledWith(
      42,
      5,
      expect.objectContaining({ state_event: 'close' }),
    );
  });

  it('updates entities whose local hash changed', async () => {
    await seedConfig();
    const ms = makeMilestone('m1', {
      gitlab: {
        milestone_id: 101,
        project_id: 42,
        base_url: 'https://gitlab.com',
        last_sync_hash: 'sha256:old',
        synced_at: '2026-01-01T00:00:00Z',
      },
    });
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    const state: SyncState = {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        m1: {
          gitlab_milestone_id: 101,
          local_hash: 'sha256:different', // differs from computed → updates
          remote_hash: 'sha256:different',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    };
    await saveState(metaDir, state);

    fake.updateMilestone.mockResolvedValueOnce(makeGlMilestone({ id: 101 }));

    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.updated.milestones).toBe(1);
    expect(fake.updateMilestone).toHaveBeenCalled();
  });

  it('does not update when local hash matches state', async () => {
    await seedConfig();
    const ms = makeMilestone('m1', {
      gitlab: {
        milestone_id: 101,
        project_id: 42,
        base_url: 'https://gitlab.com',
        last_sync_hash: 'sha256:old',
        synced_at: '2026-01-01T00:00:00Z',
      },
    });
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);

    // Compute hash from what parseTree actually reads back from disk
    const { parseTree } = await import('@gitpm/core');
    const parsed = await parseTree(metaDir);
    if (!parsed.ok) throw parsed.error;
    const matchedHash = computeContentHash(parsed.value.milestones[0]);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        m1: {
          gitlab_milestone_id: 101,
          local_hash: matchedHash,
          remote_hash: matchedHash,
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });

    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.updated.milestones).toBe(0);
    expect(fake.updateMilestone).not.toHaveBeenCalled();
  });

  it('closes remote issues for locally deleted entities', async () => {
    await seedConfig();
    // Nothing on disk except roadmap
    await writeMeta(makeRoadmap());

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        removed: {
          gitlab_issue_iid: 7,
          local_hash: 'sha256:x',
          remote_hash: 'sha256:x',
          synced_at: '2026-01-01T00:00:00Z',
        },
        'removed-ms': {
          gitlab_milestone_id: 8,
          local_hash: 'sha256:y',
          remote_hash: 'sha256:y',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });

    fake.updateIssue.mockResolvedValue(
      makeGlIssue({ iid: 7, state: 'closed' }),
    );
    fake.updateMilestone.mockResolvedValue(
      makeGlMilestone({ id: 8, state: 'closed' }),
    );

    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fake.updateIssue).toHaveBeenCalledWith(
      42,
      7,
      expect.objectContaining({ state_event: 'close' }),
    );
    expect(fake.updateMilestone).toHaveBeenCalledWith(
      42,
      8,
      expect.objectContaining({ state_event: 'close' }),
    );
    expect(result.value.totalChanges).toBeGreaterThanOrEqual(2);
  });

  it('resolves epic milestone_ref via state-tracked milestone', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    const epic = makeEpic('e1', { milestone_ref: { id: 'm1' } });
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);
    await writeMeta(epic);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        m1: {
          gitlab_milestone_id: 101,
          local_hash: computeContentHash(ms),
          remote_hash: computeContentHash(ms),
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });

    fake.createIssue.mockResolvedValueOnce(makeGlIssue({ iid: 20 }));

    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    expect(fake.createIssue).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ milestone_id: 101 }),
    );
  });

  it('updates existing issue when hash changed', async () => {
    await seedConfig();
    const story = makeStory('s1', {
      gitlab: {
        issue_iid: 50,
        project_id: 42,
        base_url: 'https://gitlab.com',
        last_sync_hash: 'sha256:old',
        synced_at: '2026-01-01T00:00:00Z',
      },
    });
    await writeMeta(makeRoadmap());
    await writeMeta(story);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        s1: {
          gitlab_issue_iid: 50,
          local_hash: 'sha256:diff',
          remote_hash: 'sha256:diff',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });

    fake.updateIssue.mockResolvedValueOnce(makeGlIssue({ iid: 50 }));

    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.updated.issues).toBe(1);
    expect(fake.updateIssue).toHaveBeenCalled();
  });

  it('returns error Result when client throws', async () => {
    await seedConfig();
    await writeMeta(makeRoadmap());
    await writeMeta(makeStory('s1'));

    fake.createIssue.mockRejectedValueOnce(new Error('GitLab down'));

    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/GitLab down/);
  });

  it('updates epic with milestone_id resolved via state-tracked milestone', async () => {
    await seedConfig();
    const ms = makeMilestone('m1');
    const epic = makeEpic('e1', {
      milestone_ref: { id: 'm1' },
      gitlab: {
        issue_iid: 20,
        project_id: 42,
        base_url: 'https://gitlab.com',
        last_sync_hash: 'sha256:old',
        synced_at: '2026-01-01T00:00:00Z',
      },
    });
    await writeMeta(makeRoadmap([{ id: 'm1' }]));
    await writeMeta(ms);
    await writeMeta(epic);

    const { parseTree } = await import('@gitpm/core');
    const parsed = await parseTree(metaDir);
    if (!parsed.ok) throw parsed.error;
    const msHash = computeContentHash(parsed.value.milestones[0]);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        m1: {
          gitlab_milestone_id: 101,
          local_hash: msHash,
          remote_hash: msHash,
          synced_at: '2026-01-01T00:00:00Z',
        },
        e1: {
          gitlab_issue_iid: 20,
          local_hash: 'sha256:diff',
          remote_hash: 'sha256:diff',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });

    fake.updateIssue.mockResolvedValueOnce(makeGlIssue({ iid: 20 }));

    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    expect(fake.updateIssue).toHaveBeenCalledWith(
      42,
      20,
      expect.objectContaining({ milestone_id: 101 }),
    );
  });

  it('respects PRDs in tree (does not close PRDs)', async () => {
    await seedConfig();
    const prd = {
      type: 'prd' as const,
      id: 'p1',
      title: 'PRD Document',
      status: 'in_progress' as const,
      body: '',
      filePath: '.meta/prds/p1.md',
    };
    await writeMeta(makeRoadmap());
    await writeMeta(prd);

    await saveState(metaDir, {
      project: 'ns/proj',
      project_id: 42,
      last_sync: '2026-01-01T00:00:00Z',
      entities: {
        p1: {
          gitlab_issue_iid: 99,
          local_hash: 'sha256:x',
          remote_hash: 'sha256:x',
          synced_at: '2026-01-01T00:00:00Z',
        },
      },
    });

    const result = await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
    });
    expect(result.ok).toBe(true);
    // PRD id is in tree.prds.map(p=>p.id), so it's not a "deleted" entity,
    // and no issue close should fire
    expect(fake.updateIssue).not.toHaveBeenCalled();
  });

  it('uses baseUrl and projectId overrides from options', async () => {
    await seedConfig();
    await writeMeta(makeRoadmap());
    await writeMeta(makeStory('s1'));

    fake.createIssue.mockResolvedValueOnce(makeGlIssue({ iid: 1 }));

    await exportToGitLab({
      token: 'tok',
      project: 'ns/proj',
      metaDir,
      projectId: 999,
      baseUrl: 'https://gl.example.com',
    });
    expect(fake.createIssue).toHaveBeenCalledWith(999, expect.any(Object));
  });
});
