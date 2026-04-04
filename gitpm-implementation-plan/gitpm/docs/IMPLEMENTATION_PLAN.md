# GitPM Implementation Plan

This document is the authoritative implementation plan for GitPM MVP. Each phase is self-contained with clear inputs, outputs, and acceptance criteria. Phases must be implemented in order — each depends on the previous.

---

## Phase 0: Scaffold Monorepo

### Goal
Set up the Bun workspace monorepo with all packages, tooling configuration, and CI-ready structure.

### Tasks

**0.1** Create root `package.json` with Bun workspaces pointing to `packages/*`.

**0.2** Create `tsconfig.json` (base) with strict mode, ESM, `moduleResolution: "bundler"`, `target: "ES2022"`. Each package gets its own `tsconfig.json` extending the base.

**0.3** Configure Biome (`biome.json`) with: indent 2 spaces, single quotes, trailing commas, organize imports. Add lint rules: `noExplicitAny: error`, `useConst: error`.

**0.4** Configure Vitest (`vitest.config.ts`) at root with workspace-aware setup.

**0.5** Create all four package directories with their `package.json` files:
- `packages/core` → `@gitpm/core` (no dependencies yet)
- `packages/sync-github` → `@gitpm/sync-github` (depends on `@gitpm/core`)
- `packages/cli` → `gitpm` (depends on `@gitpm/core`, `@gitpm/sync-github`)
- `packages/ui` → `@gitpm/ui` (depends on `@gitpm/core`)

**0.6** Add a placeholder `src/index.ts` exporting nothing in each package.

**0.7** Configure `tsup` build for `core`, `sync-github`, and `cli`. Configure Vite for `ui`.

**0.8** Add root scripts: `build`, `test`, `lint`, `dev:ui`.

**0.9** Create `.gitignore` (node_modules, dist, .env, coverage).

**0.10** Verify: `bun install`, `bun run build`, `bun run test`, `bun run lint` all pass with zero errors.

### Acceptance Criteria
- All four packages exist and resolve each other via workspace references.
- `bun run build` produces dist output for core, sync-github, cli.
- `bun run test` runs (with zero tests, exits 0).
- `bun run lint` passes.

---

## Phase 1: @gitpm/core — Schema Engine

### Goal
Build the core library that parses, validates, resolves, and writes `.meta/` file trees. This is the foundation everything else depends on.

### Reference
Read `docs/schemas/ENTITY_SCHEMAS.md` for the complete Zod schema definitions and file format specifications.

### Tasks

**1.1 — Zod Schemas** (`packages/core/src/schemas/`)

Create Zod schemas for every entity type. Each schema defines both the frontmatter structure and the full parsed entity (frontmatter + body markdown + file metadata).

Files to create:
- `common.ts` — shared types: `EntityId` (nanoid-based), `Status` enum (`backlog | todo | in_progress | in_review | done | cancelled`), `Priority` enum (`low | medium | high | critical`), `GitHubSyncMeta` (issue_number, project_item_id, last_sync_hash, synced_at), `EntityRef` (id + path reference to another entity).
- `story.ts` — Story schema: title, status, priority, assignee, labels[], estimate, github sync meta, epic_ref (nullable EntityRef), description (markdown body).
- `epic.ts` — Epic schema: title, status, priority, owner, labels[], milestone_ref (nullable EntityRef), description, stories (resolved at read-time, not stored).
- `milestone.ts` — Milestone schema: title, target_date, status, description, epic_refs[].
- `roadmap.ts` — Roadmap schema: title, description, milestones[] (resolved refs).
- `prd.ts` — PRD schema: title, status, owner, created_at, updated_at, epic_refs[], description (long-form markdown body).
- `index.ts` — re-export all schemas and types.

Every schema must export both the Zod object (`storySchema`) and the inferred TypeScript type (`type Story = z.infer<typeof storySchema>`).

Write tests for each schema validating both happy-path parsing and error cases.

**1.2 — Parser** (`packages/core/src/parser/`)

The parser reads `.meta/` files from disk and returns typed entities.

- `parse-file.ts` — `parseFile(filePath: string): Promise<Result<ParsedEntity>>`. Uses `gray-matter` to split frontmatter from body. Determines entity type from frontmatter's `type` field. Validates with the corresponding Zod schema. Returns the validated, typed entity with its file path attached.
- `parse-tree.ts` — `parseTree(metaDir: string): Promise<Result<MetaTree>>`. Recursively reads all `.md` and `.yaml` files under the given directory. Calls `parseFile` on each. Returns a `MetaTree` object: `{ stories: Story[], epics: Epic[], milestones: Milestone[], roadmaps: Roadmap[], prds: PRD[], errors: ParseError[] }`. Must handle partial failures gracefully — parse what you can, collect errors for the rest.
- `types.ts` — `ParsedEntity` discriminated union, `MetaTree` type, `ParseError` type.

Write tests using fixture files. Create a `packages/core/src/__fixtures__/` directory with sample `.meta/` structures (valid tree, tree with errors, empty tree).

**1.3 — Writer** (`packages/core/src/writer/`)

The writer serializes entities back to files.

- `write-file.ts` — `writeFile(entity: ParsedEntity, filePath: string): Promise<Result<void>>`. Separates frontmatter from body. Uses `yaml` to serialize frontmatter. Writes the file with `---` delimiters. Must preserve any fields in frontmatter that the schema doesn't know about (forward-compatibility).
- `write-tree.ts` — `writeTree(tree: MetaTree, metaDir: string): Promise<Result<void>>`. Writes/updates all entities in the tree to their file paths. Does not delete files that aren't in the tree (additive only).
- `scaffold.ts` — `scaffoldMeta(metaDir: string, projectName: string): Promise<Result<void>>`. Creates the initial `.meta/` directory structure with a sample roadmap, one epic, and one story. Used by `gitpm init`.

Write round-trip tests: parse a fixture, write it back, parse again, compare. Must be lossless.

**1.4 — Resolver** (`packages/core/src/resolver/`)

The resolver builds the dependency graph from cross-references.

- `resolve.ts` — `resolveRefs(tree: MetaTree): Result<ResolvedTree>`. Walks all entities, matches `EntityRef` fields to actual entities by ID. Populates reverse references (e.g., an epic's `stories` field is populated by finding all stories whose `epic_ref` points to it). Returns a `ResolvedTree` which is a `MetaTree` augmented with resolved relationships.
- `graph.ts` — `buildDependencyGraph(tree: ResolvedTree): DependencyGraph`. Returns an adjacency list representation of the dependency DAG. Includes a `topologicalSort()` method and a `findCycles()` method.

Write tests with fixture trees that include valid refs, broken refs, and circular refs.

**1.5 — Validator** (`packages/core/src/validator/`)

Tree-wide validation rules.

- `validate.ts` — `validateTree(tree: ResolvedTree): ValidationResult`. Checks: no orphaned references (entity refs pointing to non-existent IDs), no circular dependencies, status consistency (epic can't be `done` if it has `in_progress` stories), required fields present, unique IDs across the entire tree.
- `types.ts` — `ValidationResult` type: `{ valid: boolean, errors: ValidationError[], warnings: ValidationWarning[] }`. Errors block operations. Warnings are informational.

Write tests for each validation rule.

**1.6 — Public API** (`packages/core/src/index.ts`)

Export everything through a clean public API:
```ts
export { parseFile, parseTree } from './parser';
export { writeFile, writeTree, scaffoldMeta } from './writer';
export { resolveRefs, buildDependencyGraph } from './resolver';
export { validateTree } from './validator';
export * from './schemas';
```

### Acceptance Criteria
- `parseTree` correctly parses the fixture `.meta/` directory into typed entities.
- `writeTree` round-trips losslessly.
- `resolveRefs` correctly links epics to stories, milestones to epics, etc.
- `validateTree` catches orphaned refs, cycles, and status inconsistencies.
- All tests pass. At least 30 tests across the package.

---

## Phase 2: @gitpm/cli — Init & Validate

### Goal
Ship the first two CLI commands so a user can create a `.meta/` tree and validate it.

### Tasks

**2.1 — CLI Framework** (`packages/cli/src/index.ts`)

Set up `commander` with the `gitpm` binary name. Add `--version` from package.json. Add `--meta-dir` global option (default: `.meta` relative to cwd).

**2.2 — `gitpm init` command** (`packages/cli/src/commands/init.ts`)

Prompts for project name (or takes it as argument). Calls `scaffoldMeta()` from `@gitpm/core`. Prints the created file tree. Exits 0 on success.

**2.3 — `gitpm validate` command** (`packages/cli/src/commands/validate.ts`)

Calls `parseTree()` → `resolveRefs()` → `validateTree()`. Prints errors and warnings with file paths and line numbers where possible. Exits 1 if validation errors exist, 0 otherwise.

**2.4 — Binary setup**

In `packages/cli/package.json`, set `"bin": { "gitpm": "./dist/index.js" }`. Ensure the build output has a shebang (`#!/usr/bin/env node`). Verify `bun link` makes `gitpm` available globally for development.

### Acceptance Criteria
- `gitpm init my-project` creates a valid `.meta/` directory with sample content.
- `gitpm validate` passes on the freshly created tree.
- `gitpm validate` correctly reports errors on a hand-crafted broken tree.
- Both commands have `--help` output.

---

## Phase 3: @gitpm/sync-github — Import (Flow 1)

### Goal
Import an existing GitHub repository's Issues, Milestones, and Project board into a `.meta/` file tree.

### Tasks

**3.1 — GitHub Client Setup** (`packages/sync-github/src/client.ts`)

Create a thin wrapper around `@octokit/rest` that handles authentication (token from env var `GITHUB_TOKEN` or `--token` CLI flag), rate limiting (respect `x-ratelimit-remaining` headers, sleep when approaching 0), and pagination (auto-paginate all list endpoints).

**3.2 — Mapper** (`packages/sync-github/src/mapper.ts`)

Define the mapping between GitHub resources and GitPM entities:

- GitHub Milestone → GitPM Milestone. Map: `title`, `due_on` → `target_date`, `state` → `status` (open → `in_progress`, closed → `done`), `description`.
- GitHub Issue (without parent) → GitPM Story or Epic. Heuristic: if the issue has sub-issues (tracked via task lists) or a `epic` label, treat it as an Epic. Otherwise it's a Story. Map: `title`, `state` → `status`, `body` → description, `assignee`, `labels`, `milestone` → `milestone_ref`.
- GitHub Issue (with parent) → GitPM Story under the parent Epic.
- GitHub Project (v2) columns/status → GitPM status. Map the project's status field values to the `Status` enum. User-configurable via a mapping in `/.meta/sync/github-config.yaml`.

Create bidirectional mapping functions: `ghIssueToStory()`, `ghIssueToEpic()`, `ghMilestoneToMilestone()`, and their inverses.

**3.3 — Import Engine** (`packages/sync-github/src/import.ts`)

`importFromGitHub(options: ImportOptions): Promise<Result<ImportResult>>`

Steps:
1. Fetch all milestones from the repo.
2. Fetch all issues (open and closed, paginated).
3. Fetch the Project board (if project URL/number is provided).
4. Apply the mapper to convert GitHub resources to GitPM entities.
5. Generate entity IDs (nanoid) and cross-reference them.
6. Determine folder structure: `/.meta/roadmap/roadmap.yaml` for milestones, `/.meta/epics/<epic-slug>/epic.md` for epics, `/.meta/epics/<epic-slug>/stories/<story-slug>.md` for stories under epics, `/.meta/stories/<story-slug>.md` for orphan stories.
7. Call `writeTree()` to write everything to disk.
8. Create `/.meta/sync/github-state.json` with the initial sync state (every entity mapped to its GitHub counterpart with current content hash).
9. Create `/.meta/sync/github-config.yaml` with the repo URL, project number, and status mapping used.
10. Return an `ImportResult` with counts of each entity type created.

**3.4 — Sync State** (`packages/sync-github/src/state.ts`)

Define the sync state structure:
```ts
interface SyncState {
  repo: string;                    // owner/repo
  project_number?: number;
  last_sync: string;               // ISO timestamp
  entities: Record<EntityId, {
    github_issue_number?: number;
    github_project_item_id?: string;
    local_hash: string;            // hash of local file content at last sync
    remote_hash: string;           // hash of GitHub content at last sync
    synced_at: string;
  }>;
}
```

Functions: `loadState()`, `saveState()`, `computeContentHash()` (deterministic hash of the entity's meaningful fields, excluding metadata like synced_at).

**3.5 — Tests**

Create fixture data: mock GitHub API responses (JSON files) for a repo with 2 milestones, 5 issues (2 epics, 3 stories), and a Project board. Write integration tests that mock Octokit and verify the import produces the correct file tree. Test edge cases: issues with no milestone, issues with no body, closed milestones, labels.

### Acceptance Criteria
- Given a GitHub repo with issues and milestones, `importFromGitHub()` produces a valid `.meta/` tree.
- The generated tree passes `validateTree()`.
- Every imported entity has correct `github` sync metadata in its frontmatter.
- `github-state.json` accurately reflects the initial sync state.
- Works with repos that have no Project board (just Issues + Milestones).
- Works with repos that have no Milestones (just Issues).

---

## Phase 4: @gitpm/sync-github — Export & Bidirectional Sync (Flow 2)

### Goal
Push locally-created `.meta/` entities to GitHub and implement bidirectional sync.

### Tasks

**4.1 — Export Engine** (`packages/sync-github/src/export.ts`)

`exportToGitHub(options: ExportOptions): Promise<Result<ExportResult>>`

Steps:
1. Parse the local `.meta/` tree.
2. Load sync state (if exists — may be first export).
3. For entities without GitHub sync metadata (new entities):
   - Create GitHub Milestones for GitPM milestones.
   - Create GitHub Issues for epics and stories.
   - If a Project board number is configured, add items to the project and set their status.
   - Write back the GitHub IDs into each entity's frontmatter.
   - Update sync state.
4. For entities with existing sync metadata (updates):
   - Compare local content hash with the hash stored in sync state.
   - If changed, push the update to GitHub (update issue title, body, state, labels, assignee, milestone).
   - Update sync state.
5. Return export result with counts.

**4.2 — Diff Engine** (`packages/sync-github/src/diff.ts`)

`diffEntity(local: ParsedEntity, remote: GitHubResource, lastState: SyncEntityState): DiffResult`

Field-level diff that returns which fields changed on which side:
```ts
interface DiffResult {
  status: 'in_sync' | 'local_changed' | 'remote_changed' | 'conflict';
  localChanges: FieldChange[];
  remoteChanges: FieldChange[];
  conflicts: FieldConflict[];
}
```

A conflict occurs when the same field changed on both sides since the last sync (both hashes differ from the stored baseline).

**4.3 — Conflict Resolution** (`packages/sync-github/src/conflict.ts`)

For MVP, conflict resolution is interactive (used by the CLI):

`resolveConflicts(conflicts: FieldConflict[]): Promise<Resolution[]>`

Each conflict presents both versions and asks the user to pick `local`, `remote`, or provide a manual merge. Returns the resolved values. The CLI (Phase 5) will provide the interactive UI for this.

**4.4 — Bidirectional Sync** (`packages/sync-github/src/sync.ts`)

`syncWithGitHub(options: SyncOptions): Promise<Result<SyncResult>>`

This is the main sync function that combines pull and push:
1. Load sync state.
2. Fetch current state of all mapped GitHub entities.
3. Parse current local `.meta/` tree.
4. For each entity, run `diffEntity()`.
5. Apply non-conflicting changes automatically: local-only changes → push to GitHub, remote-only changes → write to local files.
6. For conflicts, collect them and return them for resolution (or apply a default strategy if `--strategy=local-wins` or `--strategy=remote-wins` is set).
7. After resolution, apply all changes and update sync state.

**4.5 — Entity Deletion Handling**

Define deletion behavior for MVP:
- If an entity file is deleted locally but exists on GitHub: mark the GitHub issue as closed (not deleted). Add a `_deleted_locally: true` note.
- If a GitHub issue is closed/deleted but exists locally: update the local entity's status to `done` or `cancelled`. Do not delete the file.
- Actual file/issue deletion requires an explicit `gitpm prune` command (post-MVP).

**4.6 — Tests**

Test scenarios:
- Fresh export (no prior sync state) creates issues and milestones.
- Incremental export detects changed fields and updates GitHub.
- Pull detects remote changes and updates local files.
- Conflict detection works correctly for same-field changes.
- Deletion handling works in both directions.
- `local-wins` and `remote-wins` strategies work.

### Acceptance Criteria
- `exportToGitHub()` creates Issues, Milestones, and Project items from a local `.meta/` tree.
- `syncWithGitHub()` correctly handles: local-only changes, remote-only changes, no changes, and conflicts.
- Conflict detection is field-level accurate.
- Sync state is correctly updated after every operation.
- Round-trip works: import → modify locally → sync → modify on GitHub → sync → local reflects remote changes.

---

## Phase 5: @gitpm/cli — Sync Commands

### Goal
Wire up all sync functionality into CLI commands.

### Tasks

**5.1 — `gitpm import` command** (`packages/cli/src/commands/import.ts`)

```
gitpm import --repo <owner/repo> [--project <number>] [--token <token>]
```

Calls `importFromGitHub()`. Shows a progress spinner via `ora`. Prints summary of imported entities. Suggests running `gitpm validate` after.

**5.2 — `gitpm push` command** (`packages/cli/src/commands/push.ts`)

```
gitpm push [--token <token>] [--dry-run]
```

Calls `exportToGitHub()`. `--dry-run` shows what would be pushed without making API calls. Shows a diff summary before pushing and asks for confirmation (unless `--yes` flag).

**5.3 — `gitpm pull` command** (`packages/cli/src/commands/pull.ts`)

```
gitpm pull [--token <token>] [--strategy <local-wins|remote-wins|ask>]
```

Fetches remote state and applies remote-only changes to local files. For conflicts, uses the specified strategy (default: `ask`, which prompts interactively).

**5.4 — `gitpm sync` command** (`packages/cli/src/commands/sync.ts`)

```
gitpm sync [--token <token>] [--strategy <local-wins|remote-wins|ask>] [--dry-run]
```

Full bidirectional sync. Combines pull and push. Shows a summary table of changes in each direction. Handles conflicts per the strategy flag.

**5.5 — Interactive Conflict Resolution UI**

When `--strategy=ask`, present conflicts using a formatted CLI prompt:

```
CONFLICT: story "Implement forecasting API" — field "status"
  Local:  in_review  (changed 2h ago)
  Remote: done       (changed 1h ago)
  
  [l] Keep local  [r] Keep remote  [s] Skip
```

Use `@inquirer/prompts` or similar for the interactive prompt.

**5.6 — Auth Flow**

Support three auth methods in order of priority:
1. `--token` CLI flag
2. `GITHUB_TOKEN` environment variable
3. `gh auth token` subprocess call (if GitHub CLI is installed)

Create `packages/cli/src/utils/auth.ts` that tries these in order.

### Acceptance Criteria
- All four commands work end-to-end against a real GitHub repository.
- `--dry-run` shows accurate previews without side effects.
- Interactive conflict resolution works correctly.
- Auth falls through correctly from flag → env → gh CLI.
- `--help` works for every command.

---

## Phase 6: @gitpm/ui — Local Web Interface

### Goal
Build a local web application that renders the `.meta/` tree as a project management UI.

### Tasks

**6.1 — Project Setup**

Vite + React + Tailwind CSS + TanStack Router. The UI is a local dev server that reads files from disk. It communicates with the `.meta/` tree via a lightweight local API server (or directly via Bun's file APIs if running in Bun).

Create a minimal Express/Hono API server (`packages/ui/src/server/`) that wraps `@gitpm/core` functions as REST endpoints:
- `GET /api/tree` — returns the full parsed and resolved tree as JSON
- `GET /api/entity/:id` — returns a single entity
- `PUT /api/entity/:id` — updates an entity (writes to file)
- `POST /api/entity` — creates a new entity (creates file)
- `GET /api/validate` — returns validation results
- `GET /api/sync/status` — returns sync state summary
- `POST /api/sync/push` — triggers push (calls sync-github)
- `POST /api/sync/pull` — triggers pull
- `POST /api/sync/sync` — triggers bidirectional sync

**6.2 — Layout & Navigation**

App shell with:
- Left sidebar: file tree navigator showing the `.meta/` hierarchy. Folders are collapsible. Each entity shows an icon (by type) and a status badge (colored dot).
- Top bar: project name, sync status indicator (last synced time + green/yellow/red dot), "Sync Now" button, "Validate" button.
- Main content area: renders the selected view.

Use Tailwind for styling. Design system: neutral grays for chrome, colored status badges (green=done, blue=in_progress, yellow=todo, gray=backlog, red=cancelled). Clean, developer-tool aesthetic — think Linear, not Jira.

**6.3 — Tree Browser View** (default view)

Table/list showing all entities, grouped by type or by hierarchy. Columns: title (with indentation for hierarchy depth), type badge, status badge, assignee, GitHub link (external link icon to the GitHub Issue). Clicking a row opens the Entity Editor.

Implement basic filtering: by status, by type, by assignee. Implement text search across titles.

**6.4 — Entity Editor View**

Split view: left panel shows structured frontmatter fields as form inputs (title text input, status dropdown, priority dropdown, assignee text input, labels tag input, references as searchable dropdowns). Right panel shows the markdown body in a textarea with live preview (or a simple markdown editor like `@uiw/react-md-editor`).

"Save" button writes changes back to the file via the API. Show a toast notification on success.

"Open in GitHub" button (visible when entity has sync metadata) opens the corresponding GitHub Issue in a new tab.

**6.5 — Roadmap Timeline View**

Horizontal timeline rendering milestones and their associated epics. X-axis is time (months). Each milestone is a vertical marker on the timeline. Epics are horizontal bars positioned under their milestone. Color-coded by status.

Use a simple SVG or Canvas rendering — no need for a charting library. This is a read-only visualization in MVP (editing happens through the Entity Editor).

**6.6 — Sync Dashboard View**

Table showing every synced entity with columns: title, local status, remote status, sync state (in_sync / local_ahead / remote_ahead / conflict), last synced timestamp. Color-coded rows: green = in sync, yellow = one side ahead, red = conflict.

Action buttons: "Pull Remote Changes", "Push Local Changes", "Full Sync". Each triggers the corresponding API call and refreshes the view.

Conflict resolution: when conflicts exist, show an inline expandable panel for each conflicted entity showing both versions with a "Keep Local" / "Keep Remote" button per field.

**6.7 — Dev Server Script**

Create a `dev` script that starts both the API server and the Vite dev server. The Vite dev server proxies `/api` requests to the API server. Single command: `bun run dev:ui -- --meta-dir /path/to/.meta`.

### Acceptance Criteria
- `bun run dev:ui` starts a working local web app.
- Tree browser shows all entities from the `.meta/` directory with correct hierarchy and status badges.
- Entity editor can modify an entity and the change is persisted to the file on disk.
- Roadmap timeline renders milestones and epics chronologically.
- Sync dashboard accurately reflects sync state and can trigger push/pull/sync operations.
- The UI works in Chrome and Firefox. Mobile responsiveness is not required for MVP.

---

## Implementation Order & Dependencies

```
Phase 0 ─→ Phase 1 ─→ Phase 2 ─→ Phase 3 ─→ Phase 4 ─→ Phase 5
                │                                           │
                └───────────────────────────────────────────┴─→ Phase 6
```

Phase 6 (UI) depends on Phase 1 (core) directly and benefits from Phase 4/5 (sync) for the sync dashboard, but the tree browser and editor can be built in parallel with the sync work.

## Estimated Effort

- Phase 0: 1 session (scaffolding)
- Phase 1: 3-4 sessions (largest phase — core engine)
- Phase 2: 1 session (thin CLI layer)
- Phase 3: 2 sessions (GitHub API integration)
- Phase 4: 2-3 sessions (bidirectional sync is complex)
- Phase 5: 1 session (wiring CLI to sync)
- Phase 6: 3-4 sessions (UI views)

Total: ~13-16 Claude Code sessions.
