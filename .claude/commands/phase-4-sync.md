# Phase 4: @gitpm/sync-github — Export & Bidirectional Sync (Flow 2)

Read `CLAUDE.md` for project context, `docs/IMPLEMENTATION_PLAN.md` Phase 4, and `docs/schemas/ENTITY_SCHEMAS.md` for sync-related schemas.

Depends on: Phase 1 (@gitpm/core), Phase 3 (import, mapper, state, config).

## Execute in order

### Step 1: Export Engine

Create `packages/sync-github/src/export.ts`:

`exportToGitHub(options: ExportOptions): Promise<Result<ExportResult>>`

```ts
interface ExportOptions {
  token: string;
  metaDir: string;
  dryRun?: boolean;  // if true, return what would change without API calls
}
```

Implementation:
1. Load `github-config.yaml` for repo and project settings.
2. Load sync state (may not exist for first export).
3. Parse the local `.meta/` tree and resolve refs.
4. Partition entities into two groups:
   - **New** — entities without `github` sync metadata in frontmatter AND without an entry in sync state.
   - **Existing** — entities with sync metadata.
5. For **new** entities:
   - Create GitHub Milestones first (other entities may reference them).
   - Create GitHub Issues for epics and stories. Set milestone, labels, assignee, body.
   - If project is configured, add each issue to the GitHub Project and set its status field.
   - Write back the GitHub IDs (issue_number, project_item_id, milestone_id) into each entity's frontmatter by calling `writeFile()`.
   - Add entries to sync state with current content hashes.
6. For **existing** entities:
   - Compute current local content hash.
   - Compare with `local_hash` stored in sync state.
   - If changed: push updates to GitHub (update issue title, body, state, labels, assignee, milestone). Update sync state.
   - If unchanged: skip.
7. If `dryRun`, skip all API calls and file writes. Return what would happen.
8. Save updated sync state.
9. Return `ExportResult`: `{ created: number, updated: number, unchanged: number, errors: ExportError[] }`.

### Step 2: Diff Engine

Create `packages/sync-github/src/diff.ts`:

`diffEntity(local: ParsedEntity, remoteGh: GitHubIssue | GitHubMilestone, lastState: SyncEntityState): DiffResult`

```ts
interface FieldChange {
  field: string;       // e.g., "title", "status", "body"
  oldValue: unknown;
  newValue: unknown;
}

interface FieldConflict {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  baseValue: unknown;   // value at last sync
}

interface DiffResult {
  entityId: string;
  status: 'in_sync' | 'local_changed' | 'remote_changed' | 'both_changed' | 'conflict';
  localChanges: FieldChange[];
  remoteChanges: FieldChange[];
  conflicts: FieldConflict[];
}
```

Implementation:
1. Compute current local content hash and current remote content hash (by mapping the GitHub resource back to entity format and hashing).
2. Compare local hash to `lastState.local_hash` → detect local changes.
3. Compare remote hash to `lastState.remote_hash` → detect remote changes.
4. If only one side changed → no conflict, return the changes.
5. If both sides changed → do field-level comparison:
   - For each diffable field (`title`, `status`, `priority`, `assignee`, `labels`, `body`), compare local vs baseline and remote vs baseline.
   - If the same field changed on both sides to different values → conflict.
   - If the same field changed on both sides to the same value → not a conflict (convergent edit).
   - If different fields changed → no conflict, merge both changes.

Write tests for every combination: no change, local only, remote only, both sides same field, both sides different fields, convergent edit.

### Step 3: Conflict Types and Resolution

Create `packages/sync-github/src/conflict.ts`:

```ts
type ResolutionStrategy = 'local-wins' | 'remote-wins' | 'ask';

interface Resolution {
  entityId: string;
  field: string;
  chosenValue: unknown;
  source: 'local' | 'remote' | 'manual';
}
```

`applyResolutions(conflicts: FieldConflict[], strategy: ResolutionStrategy): Resolution[]`
- `local-wins`: always pick local value.
- `remote-wins`: always pick remote value.
- `ask`: return unresolved — the CLI (Phase 5) will handle interactive prompting.

`buildMergedEntity(entity: ParsedEntity, resolutions: Resolution[]): ParsedEntity`
- Apply the chosen values from resolutions to the entity, producing a merged version.

### Step 4: Bidirectional Sync

Create `packages/sync-github/src/sync.ts`:

`syncWithGitHub(options: SyncOptions): Promise<Result<SyncResult>>`

```ts
interface SyncOptions {
  token: string;
  metaDir: string;
  strategy: ResolutionStrategy;
  dryRun?: boolean;
}

interface SyncResult {
  pulled: number;       // remote changes applied locally
  pushed: number;       // local changes pushed to GitHub
  conflicts: FieldConflict[];  // unresolved conflicts (when strategy is 'ask')
  errors: SyncError[];
}
```

Implementation:
1. Load config and sync state.
2. Parse local tree.
3. Fetch current state of all mapped GitHub entities.
4. For each entity in sync state, run `diffEntity()`.
5. Collect all diffs, group by status.
6. Auto-apply non-conflicting changes:
   - `local_changed`: push to GitHub, update sync state.
   - `remote_changed`: update local file, update sync state.
   - `in_sync`: skip.
7. For `conflict` entities:
   - If strategy is `local-wins` or `remote-wins`: apply automatically.
   - If strategy is `ask`: collect and return as unresolved in `SyncResult`.
8. Handle **new local entities** (exist in tree but not in sync state): treat as export candidates. Create on GitHub.
9. Handle **deleted entities**: if a local file was deleted since last sync (entity in sync state but file missing), close the GitHub issue. If a GitHub issue was closed but local file exists, update local status to `done`.
10. If `dryRun`, skip writes.
11. Save updated sync state.

### Step 5: Re-export Public API

Update `packages/sync-github/src/index.ts`:
```ts
export { importFromGitHub } from './import';
export { exportToGitHub } from './export';
export { syncWithGitHub } from './sync';
export { diffEntity } from './diff';
export { loadState, saveState, computeContentHash } from './state';
export { loadConfig, saveConfig } from './config';
```

### Step 6: Tests

Create additional test files in `packages/sync-github/src/__tests__/`:
- `export.test.ts` — mock Octokit. Test fresh export creates issues/milestones. Test incremental export only updates changed entities.
- `diff.test.ts` — test all diff scenarios with fixture data.
- `sync.test.ts` — test full sync cycle: import → modify locally → modify remotely → sync → verify correct merge.
- `conflict.test.ts` — test resolution strategies.

## Verify

- Export test: local `.meta/` tree → creates correct GitHub resources.
- Diff engine correctly identifies all change scenarios.
- Sync round-trip: import → local edit → remote edit → sync → both sides converge.
- `local-wins` and `remote-wins` strategies work without prompts.
- Deletion handling: local delete → issue closed, remote close → local status updated.
- All tests pass.
