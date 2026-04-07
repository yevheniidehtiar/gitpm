import { describe, expect, it } from 'vitest';
import type {
  ResolvedEpic,
  ResolvedStory,
  ResolvedTree,
} from '../resolver/types.js';
import type { QualityConfig } from './config.js';
import { scoreEntities, scoreEpic, scoreStory } from './score.js';

function makeStory(overrides: Partial<ResolvedStory> = {}): ResolvedStory {
  return {
    type: 'story',
    id: 'story-1',
    title: 'Test Story',
    status: 'todo',
    priority: 'medium',
    labels: [],
    body: '',
    filePath: '/test/story.md',
    ...overrides,
  };
}

function makeEpic(overrides: Partial<ResolvedEpic> = {}): ResolvedEpic {
  return {
    type: 'epic',
    id: 'epic-1',
    title: 'Test Epic',
    status: 'todo',
    priority: 'medium',
    labels: [],
    body: '',
    filePath: '/test/epic.md',
    resolvedStories: [],
    ...overrides,
  };
}

function makeTree(
  stories: ResolvedStory[] = [],
  epics: ResolvedEpic[] = [],
): ResolvedTree {
  return {
    stories,
    epics,
    milestones: [],
    roadmaps: [],
    prds: [],
    errors: [],
  };
}

describe('scoreStory', () => {
  it('scores a minimal story at 0', () => {
    const result = scoreStory(makeStory(), null);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('scores a fully populated story at 9', () => {
    const story = makeStory({
      body: `A detailed body that is well over one hundred characters long to ensure that the body length check passes properly.

- [ ] First acceptance criterion
- [x] Second acceptance criterion`,
      labels: ['feature'],
      assignee: 'dev@test.com',
      epic_ref: { id: 'epic-1' },
      resolvedEpic: {
        type: 'epic',
        id: 'epic-1',
        title: 'Epic',
        status: 'todo',
        priority: 'medium',
        labels: [],
        body: '',
        filePath: '/test/epic.md',
        milestone_ref: { id: 'ms-1' },
      },
    });
    const result = scoreStory(story, null);
    expect(result.score).toBe(9);
    expect(result.grade).toBe('A');
  });

  it('awards +2 for body, +1 for body>100', () => {
    const short = scoreStory(makeStory({ body: 'Short body' }), null);
    expect(short.breakdown.hasBody).toBe(true);
    expect(short.breakdown.bodyOver100).toBe(false);
    expect(short.score).toBe(2);

    const long = scoreStory(
      makeStory({
        body: 'A'.repeat(101),
      }),
      null,
    );
    expect(long.breakdown.bodyOver100).toBe(true);
    expect(long.score).toBe(3);
  });

  it('awards +1 for labels', () => {
    const result = scoreStory(makeStory({ labels: ['bug'] }), null);
    expect(result.breakdown.hasLabels).toBe(true);
  });

  it('awards +1 for assignee', () => {
    const result = scoreStory(makeStory({ assignee: 'alice' }), null);
    expect(result.breakdown.hasAssignee).toBe(true);
  });

  it('uses checklist fallback when no config', () => {
    const withChecklist = scoreStory(
      makeStory({ body: '- [ ] Do something' }),
      null,
    );
    expect(withChecklist.breakdown.hasAcceptanceCriteria).toBe(true);

    const withoutChecklist = scoreStory(
      makeStory({ body: 'No checklist here' }),
      null,
    );
    expect(withoutChecklist.breakdown.hasAcceptanceCriteria).toBe(false);
  });

  it('uses template scoring when config is provided', () => {
    const config: QualityConfig = {
      template: {
        required_sections: ['Motivation', 'Acceptance Criteria'],
        min_coverage: 0.5,
      },
    };

    const passes = scoreStory(
      makeStory({ body: '## Motivation\nSome text' }),
      config,
    );
    expect(passes.breakdown.hasAcceptanceCriteria).toBe(true);

    const fails = scoreStory(makeStory({ body: 'No headings at all' }), config);
    expect(fails.breakdown.hasAcceptanceCriteria).toBe(false);
  });
});

describe('scoreEpic', () => {
  it('scores a minimal epic at 0', () => {
    const result = scoreEpic(makeEpic(), null);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('awards linkedToEpic for epics with resolved stories', () => {
    const epic = makeEpic({
      resolvedStories: [
        {
          type: 'story',
          id: 's1',
          title: 'S',
          status: 'todo',
          priority: 'low',
          labels: [],
          body: '',
          filePath: '/s.md',
        },
      ],
    });
    expect(scoreEpic(epic, null).breakdown.linkedToEpic).toBe(true);
  });

  it('awards hasMilestone for epics with milestone_ref', () => {
    const epic = makeEpic({ milestone_ref: { id: 'ms-1' } });
    expect(scoreEpic(epic, null).breakdown.hasMilestone).toBe(true);
  });

  it('uses owner field for assignee check', () => {
    const withOwner = scoreEpic(makeEpic({ owner: 'alice' }), null);
    expect(withOwner.breakdown.hasAssignee).toBe(true);

    const noOwner = scoreEpic(makeEpic({ owner: null }), null);
    expect(noOwner.breakdown.hasAssignee).toBe(false);
  });
});

describe('scoreEntities', () => {
  it('returns empty report for empty tree', () => {
    const report = scoreEntities(makeTree());
    expect(report.entities).toHaveLength(0);
    expect(report.average).toBe(0);
    expect(report.distribution).toEqual({ A: 0, B: 0, C: 0, D: 0, F: 0 });
  });

  it('computes correct average and distribution', () => {
    const tree = makeTree(
      [
        makeStory({
          id: 's1',
          body: 'Short',
          labels: ['bug'],
          assignee: 'a',
          epic_ref: { id: 'e1' },
        }),
      ],
      [
        makeEpic({
          id: 'e1',
          body: 'A'.repeat(200),
          labels: ['feature'],
          owner: 'b',
          milestone_ref: { id: 'ms-1' },
          resolvedStories: [
            {
              type: 'story',
              id: 's1',
              title: 'S',
              status: 'todo',
              priority: 'low',
              labels: [],
              body: '',
              filePath: '/s.md',
            },
          ],
        }),
      ],
    );
    const report = scoreEntities(tree);
    expect(report.entities).toHaveLength(2);
    expect(report.average).toBeGreaterThan(0);
  });

  it('grade boundaries are correct', () => {
    // F = 0-1, D = 2-3, C = 4-5, B = 6-7, A = 8-9
    const f = scoreStory(makeStory(), null);
    expect(f.grade).toBe('F');

    const d = scoreStory(makeStory({ body: 'Some body', labels: ['x'] }), null);
    // body=2, labels=1 => 3 => D
    expect(d.grade).toBe('D');
  });
});
