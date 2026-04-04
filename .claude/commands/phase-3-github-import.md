# Phase 3: @gitpm/sync-github — Import from GitHub (Flow 1)

Read `CLAUDE.md` for project context, `docs/IMPLEMENTATION_PLAN.md` Phase 3, and `docs/schemas/ENTITY_SCHEMAS.md` for sync-related schemas (GitHubSync, sync config, sync state).

Depends on: Phase 1 (@gitpm/core).

## Execute in order

### Step 1: GitHub Client Wrapper

Create `packages/sync-github/src/client.ts`:
- Thin wrapper around `@octokit/rest`.
- Constructor takes a token string. Create the Octokit instance with auth.
- Add rate-limit-aware request wrapper: check `x-ratelimit-remaining` header on responses. If remaining < 10, log a warning. If remaining === 0, sleep until `x-ratelimit-reset` timestamp.
- Add auto-pagination helper: `paginate<T>(method, params): Promise<T[]>` that follows pagination to collect all results.
- Export typed methods: `listIssues(owner, repo, options)`, `listMilestones(owner, repo)`, `getProject(owner, repo, projectNumber)`, `getProjectItems(projectId)`.

### Step 2: Mapper

Create `packages/sync-github/src/mapper.ts`:

Define bidirectional mapping functions:

- `ghMilestoneToMilestone(ghMilestone, repoSlug): Milestone` — Map `title`, `due_on` → `target_date`, `state` → status (open → `in_progress`, closed → `done`), `description` → body. Generate an ID with `nanoid(12)`. Populate `github` sync metadata.

- `ghIssueToEntity(ghIssue, config, repoSlug): Story | Epic` — Determine type: if the issue has a label matching `config.label_mapping.epic_labels` (default: `["epic"]`), create an Epic. Otherwise create a Story. Map: `title`, `state` → status (open → `todo`, closed → `done`), `body` → description, `assignee.login` → assignee, `labels[].name` → labels, `milestone.number` → milestone_ref (resolved later). Generate ID. Populate github sync metadata.

- `milestoneToGhMilestone(milestone): CreateMilestoneParams` — inverse mapping for export.

- `entityToGhIssue(entity): CreateIssueParams` — inverse mapping for export.

- `toSlug(title): string` — reuse from core or import.

- `determineFilePath(entity, parentEpicSlug?): string` — determine where in `.meta/` this entity should be written. Epics → `.meta/epics/<slug>/epic.md`. Stories with epic_ref → `.meta/epics/<epic-slug>/stories/<slug>.md`. Orphan stories → `.meta/stories/<slug>.md`. Milestones → `.meta/roadmap/milestones/<slug>.md`.

Write tests for each mapper function with realistic GitHub API response fixtures.

### Step 3: Import Engine

Create `packages/sync-github/src/import.ts`:

`importFromGitHub(options: ImportOptions): Promise<Result<ImportResult>>`

`ImportOptions`:
```ts
{
  token: string;
  repo: string;           // "owner/repo"
  projectNumber?: number;  // GitHub Project v2 number
  metaDir: string;         // target .meta/ directory
  statusMapping?: Record<string, Status>;  // project status → GitPM status
}
```

Implementation steps:
1. Create GitHub client with token.
2. Parse owner/repo from repo string.
3. Fetch all milestones via `client.listMilestones()`.
4. Fetch all issues (state: "all") via `client.listIssues()` with auto-pagination.
5. If projectNumber provided, fetch project items to get status field values.
6. Convert milestones using mapper. Store in a Map<github_milestone_number, milestone_id> for ref resolution.
7. Convert issues using mapper. For issues with a milestone, set the `milestone_ref` using the Map from step 6. For issues that are sub-issues of an epic-type issue, set `epic_ref`.
8. Build the `MetaTree` from all converted entities.
9. Generate `roadmap.yaml` referencing all milestones.
10. Call `writeTree()` to write everything to disk. Use `determineFilePath()` for each entity.
11. Write `/.meta/sync/github-config.yaml` with repo, project_number, and status_mapping used.
12. Write `/.meta/sync/github-state.json` with initial sync state for all entities.
13. Return `ImportResult`: `{ milestones: number, epics: number, stories: number, totalFiles: number }`.

### Step 4: Sync State Management

Create `packages/sync-github/src/state.ts`:
- `loadState(metaDir): Promise<Result<SyncState>>` — read and parse `github-state.json`.
- `saveState(metaDir, state): Promise<Result<void>>` — serialize and write `github-state.json`.
- `computeContentHash(entity): string` — SHA-256 of canonical JSON (sorted keys, sorted arrays, normalized whitespace). Use `node:crypto` for hashing. Follow the spec in ENTITY_SCHEMAS.md.
- `createInitialState(repo, entities, projectNumber?): SyncState` — build initial state from freshly imported entities.

Write tests: verify hash stability (same content → same hash), verify hash changes when meaningful fields change, verify hash ignores metadata fields.

### Step 5: GitHub Config Management

Create `packages/sync-github/src/config.ts`:
- `loadConfig(metaDir): Promise<Result<GitHubConfig>>` — read `github-config.yaml`.
- `saveConfig(metaDir, config): Promise<Result<void>>` — write `github-config.yaml`.
- `GitHubConfig` type matching the spec in ENTITY_SCHEMAS.md.
- Default status mapping if none provided.

### Step 6: Integration Tests

Create `packages/sync-github/src/__tests__/`:
- `import.test.ts` — mock the Octokit client (use vitest mocks). Provide fixture API responses. Verify the import produces the correct file tree structure. Verify sync state is created correctly. Test edge cases: repo with no milestones, repo with no project board, issues with no body, closed issues.
- `mapper.test.ts` — test each mapping function independently.
- `state.test.ts` — test hash computation and state serialization.

Create `packages/sync-github/src/__fixtures__/` with mock GitHub API response JSON files.

## Verify

- Import test passes: mock GitHub data → correct `.meta/` tree.
- The generated `.meta/` tree passes `validateTree()` from core.
- Every imported entity has correct `github` sync metadata in frontmatter.
- `github-state.json` has entries for every imported entity.
- `github-config.yaml` is correctly generated.
- Hash computation is deterministic.
