# GitPM — Phase 3 Demo: @gitpm/sync-github Import from GitHub

> **Status**: Complete | **Tests**: 42 passed (97 total) | **Build**: Passing | **Files**: 8 source files

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [GitHub Client](#github-client)
- [Entity Mapper](#entity-mapper)
- [Import Engine](#import-engine)
- [Sync State Management](#sync-state-management)
- [Config Management](#config-management)
- [Test Fixtures](#test-fixtures)
- [Full Test Results](#full-test-results)
- [Build Output](#build-output)
- [How to Use](#how-to-use)
- [What's Next](#whats-next)

---

## Overview

Phase 3 implements **Flow 1** of the GitHub sync engine: importing an existing GitHub repository's Issues, Milestones, and Project board into a `.meta/` file tree. This is the first half of bidirectional sync — turning GitHub's API data into GitPM's git-native format.

```
GitHub API                    GitPM .meta/
┌──────────────┐              ┌──────────────────────────┐
│  Milestones  │──┐           │ .meta/                   │
│  Issues      │  │  Import   │   roadmap/               │
│  Labels      │──┼─────────→ │     roadmap.yaml         │
│  Assignees   │  │  Engine   │     milestones/*.md      │
│  Project v2  │──┘           │   epics/<slug>/epic.md   │
└──────────────┘              │   epics/<slug>/stories/   │
                              │   stories/*.md           │
                              │   sync/github-config.yaml│
                              │   sync/github-state.json │
                              └──────────────────────────┘
```

---

## Architecture

The import pipeline has five modules:

```
┌────────────┐    ┌──────────┐    ┌──────────────┐
│   Client   │───→│  Mapper  │───→│ Import Engine │
│ (Octokit)  │    │ (GH→GPM) │    │ (orchestrate) │
└────────────┘    └──────────┘    └──────┬───────┘
                                         │
                              ┌──────────┼──────────┐
                              ▼          ▼          ▼
                         ┌────────┐ ┌────────┐ ┌────────┐
                         │ Config │ │ State  │ │ Writer │
                         │ (.yaml)│ │ (.json)│ │ (core) │
                         └────────┘ └────────┘ └────────┘
```

| Module | File | Purpose |
|--------|------|---------|
| **Client** | `client.ts` | Octokit wrapper with rate limiting & pagination |
| **Mapper** | `mapper.ts` | Bidirectional GitHub ↔ GitPM entity conversion |
| **Import** | `import.ts` | Orchestrates fetch → map → write pipeline |
| **State** | `state.ts` | Sync state tracking with SHA-256 content hashing |
| **Config** | `config.ts` | GitHub sync configuration persistence |
| **Types** | `types.ts` | Shared type definitions and defaults |

---

## GitHub Client

Thin wrapper around `@octokit/rest` with rate-limit awareness and auto-pagination.

### Key Implementation

```typescript
export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  private async checkRateLimit(response: {
    headers: Record<string, string | number | undefined>;
  }): Promise<void> {
    const remaining = Number(
      response.headers['x-ratelimit-remaining'] ?? '100',
    );
    const resetTimestamp = Number(response.headers['x-ratelimit-reset'] ?? '0');

    if (remaining === 0 && resetTimestamp > 0) {
      const waitMs = resetTimestamp * 1000 - Date.now();
      if (waitMs > 0) {
        console.warn(`Rate limit exhausted. Sleeping ${Math.ceil(waitMs / 1000)}s`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    } else if (remaining < 10) {
      console.warn(`GitHub API rate limit low: ${remaining} requests remaining.`);
    }
  }

  async paginate<T>(method, params): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    while (true) {
      const response = await method({ ...params, per_page: 100, page });
      await this.checkRateLimit(response);
      results.push(...response.data);
      if (response.data.length < 100) break;
      page++;
    }
    return results;
  }
}
```

### Typed Methods

- `listMilestones(owner, repo)` — fetches both open and closed milestones
- `listIssues(owner, repo, { state })` — auto-paginates, filters out PRs
- `getProject(owner, repo, projectNumber)` — stub for GitHub Projects v2 (GraphQL)
- `getProjectItems(projectId)` — stub for project item status fields

---

## Entity Mapper

Bidirectional mapping between GitHub API responses and GitPM entities.

### GitHub Milestone → GitPM Milestone

```typescript
export function ghMilestoneToMilestone(gh: GhMilestone, repoSlug: string): Milestone {
  const id = nanoid(12);
  const slug = toSlug(gh.title);
  const status: Status = gh.state === 'closed' ? 'done' : 'in_progress';

  return {
    type: 'milestone',
    id,
    title: gh.title,
    target_date: gh.due_on ?? undefined,
    status,
    body: gh.description ?? '',
    github: {
      milestone_id: gh.number,
      repo: repoSlug,
      last_sync_hash: '',
      synced_at: new Date().toISOString(),
    },
    filePath: `.meta/roadmap/milestones/${slug}.md`,
  };
}
```

### GitHub Issue → Story or Epic

The mapper uses label heuristics to determine entity type:

```typescript
export function isEpicIssue(gh: GhIssue, config?): boolean {
  const epicLabels = config?.label_mapping?.epic_labels ?? ['epic'];
  const issueLabels = gh.labels.map((l) => typeof l === 'string' ? l : l.name);
  return issueLabels.some((label) => epicLabels.includes(label));
}
```

| GitHub State | GitPM Status |
|-------------|-------------|
| `open` (issue) | `todo` |
| `closed` (issue) | `done` |
| `open` (milestone) | `in_progress` |
| `closed` (milestone) | `done` |

### File Path Determination

```typescript
export function determineFilePath(entity, parentEpicSlug?): string {
  if (entity.type === 'milestone') return `.meta/roadmap/milestones/${slug}.md`;
  if (entity.type === 'epic')      return `.meta/epics/${slug}/epic.md`;
  if (parentEpicSlug)              return `.meta/epics/${parentEpicSlug}/stories/${slug}.md`;
  return `.meta/stories/${slug}.md`;  // orphan story
}
```

### Mapper Test Output

```
 ✓ packages/sync-github/src/__tests__/mapper.test.ts (20 tests) 9ms
   ✓ ghMilestoneToMilestone
     ✓ maps an open milestone correctly
     ✓ maps a closed milestone to done status
     ✓ handles milestone with no description or due date
   ✓ isEpicIssue
     ✓ returns true for issues with epic label
     ✓ returns false for issues without epic label
     ✓ uses custom epic labels from config
   ✓ ghIssueToEntity
     ✓ creates an Epic from issue with epic label
     ✓ creates a Story from issue without epic label
     ✓ maps closed issues to done status
     ✓ handles issue with no body
     ✓ handles issue with no assignee
   ✓ determineFilePath
     ✓ places epics in .meta/epics/<slug>/epic.md
     ✓ places orphan stories in .meta/stories/<slug>.md
     ✓ places stories under epic when parentEpicSlug is provided
     ✓ places milestones in .meta/roadmap/milestones/<slug>.md
   ✓ milestoneToGhMilestone
     ✓ maps milestone back to GitHub params
     ✓ maps done milestone to closed state
   ✓ entityToGhIssue
     ✓ maps epic to issue with epic label added
     ✓ maps story to issue without epic label
     ✓ maps closed entity to closed state
```

---

## Import Engine

The main `importFromGitHub()` function orchestrates the entire pipeline.

### Import Flow

```
1. Parse "owner/repo" string
2. Create GitHub client with token
3. Fetch all milestones (open + closed)
4. Fetch all issues (state: "all", paginated)
5. Build label-based config for epic detection
6. Convert milestones → build number-to-ID lookup map
7. Convert issues:
   a. First pass: identify epics, set milestone refs
   b. Second pass: stories, resolve epic refs from body (#N references)
8. Generate roadmap.yaml linking all milestones
9. Write all entities to disk via @gitpm/core writeFile()
10. Save github-config.yaml
11. Save github-state.json with content hashes
12. Return ImportResult counts
```

### Usage

```typescript
import { importFromGitHub } from '@gitpm/sync-github';

const result = await importFromGitHub({
  token: 'ghp_xxxx',
  repo: 'myorg/myrepo',
  projectNumber: 5,        // optional: GitHub Project v2 number
  metaDir: '/path/to/.meta',
  statusMapping: {          // optional: custom status mapping
    'Todo': 'todo',
    'In Progress': 'in_progress',
  },
});

if (result.ok) {
  console.log(`Imported: ${result.value.milestones} milestones, ` +
    `${result.value.epics} epics, ${result.value.stories} stories`);
}
```

### Sample Import Result

The import test uses mock GitHub data with:
- 2 milestones (Q2 Launch, Q3 Scale)
- 2 epics (Balancing Engine, UI Redesign)
- 4 stories (Price Feed, Optimization Solver, Setup CI/CD, Issue with no body)
- 1 PR (filtered out automatically)

```
Import Result:
  milestones: 2
  epics: 2
  stories: 4
  totalFiles: 10

Generated .meta/ tree:
  .meta/
  ├── roadmap/
  │   ├── roadmap.yaml
  │   └── milestones/
  │       ├── q2-2026-launch.md
  │       └── q3-scale.md
  ├── epics/
  │   ├── balancing-engine/
  │   │   ├── epic.md
  │   │   └── stories/
  │   │       ├── price-feed-ingestion.md
  │   │       └── optimization-solver.md
  │   └── ui-redesign/
  │       └── epic.md
  ├── stories/
  │   ├── setup-ci-cd.md
  │   └── issue-with-no-body.md
  └── sync/
      ├── github-config.yaml
      └── github-state.json
```

### Epic Reference Detection

Stories are linked to epics by scanning issue bodies for `#N` references:

```markdown
<!-- GitHub Issue #3 body -->
Implement real-time price feed ingestion.

Part of #1    ← detected! Links to Epic issue #1
```

---

## Sync State Management

Tracks what was synced and when, enabling future bidirectional sync.

### Content Hashing

Deterministic SHA-256 hash of semantically meaningful fields only:

```typescript
export function computeContentHash(entity: ParsedEntity): string {
  const canonical = buildCanonicalObject(entity);  // sorted keys, normalized whitespace
  const json = JSON.stringify(canonical);
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}
```

**Included fields**: title, status, priority, assignee/owner, labels (sorted), body (normalized)

**Excluded fields**: filePath, created_at, updated_at, synced_at, id

### Hash Properties

```
 ✓ produces consistent hash for same content
 ✓ changes hash when title changes
 ✓ changes hash when status changes
 ✓ changes hash when body changes
 ✓ changes hash when labels change
 ✓ produces same hash regardless of label order  ← deterministic!
 ✓ ignores metadata fields (filePath, created_at, updated_at)
 ✓ normalizes whitespace in body
```

### Sync State File

```json
{
  "repo": "test-org/test-repo",
  "project_number": 5,
  "last_sync": "2026-04-04T11:08:00.000Z",
  "entities": {
    "abc123def456": {
      "github_issue_number": 3,
      "local_hash": "sha256:a1b2c3...",
      "remote_hash": "sha256:a1b2c3...",
      "synced_at": "2026-04-04T11:08:00.000Z"
    }
  }
}
```

After initial import, `local_hash === remote_hash` for every entity — both sides are in sync.

---

## Config Management

### github-config.yaml

```yaml
repo: test-org/test-repo
project_number: 5
status_mapping:
  Todo: todo
  In Progress: in_progress
  In Review: in_review
  Done: done
  Backlog: backlog
label_mapping:
  epic_labels:
    - epic
auto_sync: false
```

### Default Mappings

| Config | Default |
|--------|---------|
| Epic labels | `["epic"]` |
| Status: Todo | `todo` |
| Status: In Progress | `in_progress` |
| Status: In Review | `in_review` |
| Status: Done | `done` |
| Status: Backlog | `backlog` |
| Auto sync | `false` |

---

## Test Fixtures

Mock GitHub API responses in `__fixtures__/`:

### github-milestones.json

```json
[
  {
    "number": 1,
    "title": "Q2 2026 Launch",
    "description": "Launch the core platform features by end of Q2.",
    "state": "open",
    "due_on": "2026-06-30T00:00:00Z"
  },
  {
    "number": 2,
    "title": "Q3 Scale",
    "state": "closed",
    "due_on": "2026-09-30T00:00:00Z"
  }
]
```

### github-issues.json

7 items testing all edge cases:
- Issue #1: Epic with `epic` label + milestone + assignee
- Issue #2: Epic without milestone
- Issue #3: Story referencing epic #1 in body
- Issue #4: Closed story referencing epic #1
- Issue #5: Orphan closed story (no epic, no milestone)
- Issue #6: Issue with `null` body and no labels
- Issue #100: Pull request (filtered out by client)

---

## Full Test Results

```
$ bun run test -- --run

 RUN  v2.1.9 /home/user/gitpm

 ✓ packages/sync-github/src/__tests__/state.test.ts (14 tests) 16ms
 ✓ packages/sync-github/src/__tests__/mapper.test.ts (20 tests) 9ms
 ✓ packages/sync-github/src/__tests__/import.test.ts (8 tests) 121ms
 ✓ packages/core/src/schemas/__tests__/schemas.test.ts (20 tests) 14ms
 ✓ packages/core/src/resolver/resolver.test.ts (11 tests) 83ms
 ✓ packages/core/src/validator/validator.test.ts (6 tests) 40ms
 ✓ packages/core/src/writer/writer.test.ts (7 tests) 52ms
 ✓ packages/core/src/index.test.ts (1 test) 2ms
 ✓ packages/core/src/parser/parser.test.ts (10 tests) 32ms

 Test Files  9 passed (9)
      Tests  97 passed (97)
   Duration  1.35s
```

### Phase 3 Tests Breakdown

| Test File | Tests | Time | Coverage |
|-----------|-------|------|----------|
| `mapper.test.ts` | 20 | 9ms | All 6 mapper functions |
| `state.test.ts` | 14 | 16ms | Hash stability, state round-trip |
| `import.test.ts` | 8 | 121ms | End-to-end import with mocked API |
| **Total** | **42** | **146ms** | |

---

## Build Output

```
$ bun run build

@gitpm/sync-github build: ESM dist/index.js 15.47 KB
@gitpm/sync-github build: ESM ⚡️ Build success in 21ms
@gitpm/sync-github build: DTS dist/index.d.ts 4.84 KB
@gitpm/sync-github build: DTS ⚡️ Build success in 2047ms
```

---

## How to Use

### Install

```bash
bun install
bun run build
```

### Import from GitHub

```typescript
import { importFromGitHub } from '@gitpm/sync-github';

const result = await importFromGitHub({
  token: process.env.GITHUB_TOKEN!,
  repo: 'myorg/myrepo',
  metaDir: '.meta',
});

if (result.ok) {
  const { milestones, epics, stories, totalFiles } = result.value;
  console.log(`Imported ${milestones} milestones, ${epics} epics, ${stories} stories (${totalFiles} files)`);
} else {
  console.error(result.error.message);
}
```

### Validate the imported tree

```typescript
import { parseTree, validateTree } from '@gitpm/core';

const tree = await parseTree('.meta');
if (tree.ok) {
  const validation = validateTree(tree.value);
  console.log(`Errors: ${validation.errors.length}, Warnings: ${validation.warnings.length}`);
}
```

### Inspect sync state

```typescript
import { loadState, loadConfig } from '@gitpm/sync-github';

const state = await loadState('.meta');
if (state.ok) {
  console.log(`Last sync: ${state.value.last_sync}`);
  console.log(`Tracked entities: ${Object.keys(state.value.entities).length}`);
}
```

---

## What's Next

### Phase 4: @gitpm/sync-github — Export & Bidirectional Sync (Flow 2)

- **Export engine**: `.meta/` → GitHub Issues/Milestones
- **Diff engine**: Field-level diffing between local and remote
- **Conflict detection**: Identify concurrent edits
- **Bidirectional sync**: Merge changes from both sides
- **Sync command**: `gitpm sync` for full round-trip synchronization
