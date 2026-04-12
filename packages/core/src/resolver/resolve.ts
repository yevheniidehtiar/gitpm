import type { MetaTree, ParseError } from '../parser/types.js';
import type { Result } from '../schemas/common.js';
import type { Epic, Milestone, ParsedEntity } from '../schemas/index.js';
import type {
  ResolvedEpic,
  ResolvedMilestone,
  ResolvedPrd,
  ResolvedRoadmap,
  ResolvedSprint,
  ResolvedStory,
  ResolvedTree,
} from './types.js';

export function resolveRefs(tree: MetaTree): Result<ResolvedTree> {
  const errors: ParseError[] = [...tree.errors];

  // Build lookup maps by ID
  const allEntities = new Map<string, ParsedEntity>();
  const epicMap = new Map<string, Epic>();
  const milestoneMap = new Map<string, Milestone>();

  for (const e of tree.epics) {
    allEntities.set(e.id, e);
    epicMap.set(e.id, e);
  }
  for (const s of tree.stories) allEntities.set(s.id, s);
  for (const m of tree.milestones) {
    allEntities.set(m.id, m);
    milestoneMap.set(m.id, m);
  }
  for (const r of tree.roadmaps) allEntities.set(r.id, r);
  for (const p of tree.prds) allEntities.set(p.id, p);

  // Resolve stories
  const resolvedStories: ResolvedStory[] = tree.stories.map((story) => {
    const resolved: ResolvedStory = { ...story };
    if (story.epic_ref) {
      const epic = epicMap.get(story.epic_ref.id);
      if (epic) {
        resolved.resolvedEpic = epic;
      } else {
        errors.push({
          filePath: story.filePath,
          message: `Story "${story.title}" references non-existent epic "${story.epic_ref.id}"`,
        });
      }
    }
    return resolved;
  });

  // Resolve epics
  const resolvedEpics: ResolvedEpic[] = tree.epics.map((epic) => {
    const resolved: ResolvedEpic = {
      ...epic,
      resolvedStories: tree.stories.filter((s) => s.epic_ref?.id === epic.id),
      resolvedMilestone: undefined,
    };
    if (epic.milestone_ref) {
      const ms = milestoneMap.get(epic.milestone_ref.id);
      if (ms) {
        resolved.resolvedMilestone = ms;
      } else {
        errors.push({
          filePath: epic.filePath,
          message: `Epic "${epic.title}" references non-existent milestone "${epic.milestone_ref.id}"`,
        });
      }
    }
    return resolved;
  });

  // Resolve milestones
  const resolvedMilestones: ResolvedMilestone[] = tree.milestones.map((ms) => ({
    ...ms,
    resolvedEpics: tree.epics.filter((e) => e.milestone_ref?.id === ms.id),
  }));

  // Resolve roadmaps
  const resolvedRoadmaps: ResolvedRoadmap[] = tree.roadmaps.map((rm) => {
    const resolvedMs: Milestone[] = [];
    for (const ref of rm.milestones) {
      const ms = milestoneMap.get(ref.id);
      if (ms) {
        resolvedMs.push(ms);
      } else {
        errors.push({
          filePath: rm.filePath,
          message: `Roadmap "${rm.title}" references non-existent milestone "${ref.id}"`,
        });
      }
    }
    return { ...rm, resolvedMilestones: resolvedMs };
  });

  // Resolve PRDs
  const resolvedPrds: ResolvedPrd[] = tree.prds.map((prd) => {
    const resolvedEpicsList: Epic[] = [];
    for (const ref of prd.epic_refs) {
      const ep = epicMap.get(ref.id);
      if (ep) {
        resolvedEpicsList.push(ep);
      } else {
        errors.push({
          filePath: prd.filePath,
          message: `PRD "${prd.title}" references non-existent epic "${ref.id}"`,
        });
      }
    }
    return { ...prd, resolvedEpics: resolvedEpicsList };
  });

  // Resolve sprints
  const storyMap = new Map(tree.stories.map((s) => [s.id, s]));
  const resolvedSprints: ResolvedSprint[] = (tree.sprints ?? []).map(
    (sprint) => {
      const resolvedStoriesList: typeof tree.stories = [];
      for (const ref of sprint.stories) {
        const story = storyMap.get(ref.id);
        if (story) {
          resolvedStoriesList.push(story);
        } else {
          errors.push({
            filePath: sprint.filePath,
            message: `Sprint "${sprint.title}" references non-existent story "${ref.id}"`,
          });
        }
      }
      return { ...sprint, resolvedStories: resolvedStoriesList };
    },
  );

  return {
    ok: true,
    value: {
      stories: resolvedStories,
      epics: resolvedEpics,
      milestones: resolvedMilestones,
      roadmaps: resolvedRoadmaps,
      prds: resolvedPrds,
      sprints: resolvedSprints,
      errors,
    },
  };
}
