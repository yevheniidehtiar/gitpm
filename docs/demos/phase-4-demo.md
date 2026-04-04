# GitPM — Phase 4 Demo: @gitpm/sync-github Export & Bidirectional Sync

> **Status**: Complete | **Tests**: 129 passed (32 new) | **Build**: Passing | **Files**: 4 new source files + 4 test files

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Export Engine](#export-engine)
- [Diff Engine](#diff-engine)
- [Conflict Resolution](#conflict-resolution)
- [Bidirectional Sync](#bidirectional-sync)
- [Entity Deletion Handling](#entity-deletion-handling)
- [Client CRUD Operations](#client-crud-operations)
- [Type System](#type-system)
- [Full Test Results](#full-test-results)
- [Build Output](#build-output)
- [How to Use](#how-to-use)
- [What's Next](#whats-next)

---

## Overview

Phase 4 implements **Flow 2** of the GitHub sync engine: exporting locally-created `.meta/` entities to GitHub and full bidirectional synchronization. Combined with the Phase 3 import engine, this completes the sync loop.

```
GitHub API                          GitPM .meta/
┌──────────────┐                    ┌──────────────────────┐
│  Milestones  │◄──── Export ──────│ .meta/roadmap/       │
│  Issues      │◄──── (create/ ───│ .meta/epics/         │
│  Labels      │      update)  ───│ .meta/stories/       │
│  Assignees   │                    │                      │
│              │───── Pull  ──────►│                      │
│              │      (remote      │                      │
│              │       changes)    │                      │
└──────────────┘                    └──────────────────────┘
       ▲                                     ▲
       │           ┌─────────────┐           │
       └───────────│  Sync State │───────────┘
                   │  (hashes)   │
                   └─────────────┘
```

---

## Architecture

Phase 4 adds four new modules to the sync engine:

```
┌────────────┐    ┌──────────┐    ┌──────────────┐
│   Client   │───→│  Mapper  │───→│ Export Engine │
│ (CRUD ops) │    │ (GPM→GH) │    │ (push local) │
└────────────┘    └──────────┘    └──────┬───────┘
      │                                   │
      │           ┌──────────┐            │
      ├──────────→│   Diff   │◄───────────┤
      │           │ (fields) │            │
      │           └──────┬───┘    ┌───────┴──────┐
      │                  │        │  Bidirectional│
      │           ┌──────▼───┐    │    Sync      │
      └──────────→│ Conflict │◄───│  (merge)     │
                  │ (resolve)│    └──────────────┘
                  └──────────┘
```

| Module | File | Purpose |
|--------|------|---------|
| **Export** | `export.ts` | Push local entities to GitHub (create/update) |
| **Diff** | `diff.ts` | Field-level comparison between local & remote |
| **Conflict** | `conflict.ts` | Conflict detection & resolution strategies |
| **Sync** | `sync.ts` | Full bidirectional sync orchestration |

---

## Export Engine

`exportToGitHub()` pushes local `.meta/` entities to GitHub.

### Export Flow

```
1. Parse local .meta/ tree
2. Load sync state (or create empty state for first export)
3. For each entity:
   a. No GitHub metadata? → CREATE on GitHub
   b. Has metadata, hash changed? → UPDATE on GitHub
   c. Has metadata, hash unchanged? → SKIP (already in sync)
4. Handle locally deleted entities → CLOSE on GitHub
5. Update sync state with new hashes and GitHub IDs
```

### Usage

```typescript
import { exportToGitHub } from '@gitpm/sync-github';

const result = await exportToGitHub({
  token: 'ghp_xxxx',
  repo: 'myorg/myrepo',
  metaDir: '/path/to/.meta',
  dryRun: false,  // set true to preview without mutations
});

if (result.ok) {
  console.log(`Created: ${result.value.created.milestones} milestones, ${result.value.created.issues} issues`);
  console.log(`Updated: ${result.value.updated.milestones} milestones, ${result.value.updated.issues} issues`);
}
```

### Key Behaviors

- **First export**: Creates GitHub Issues for every story/epic, Milestones for every milestone
- **Incremental export**: Only pushes entities whose local content hash differs from the stored baseline
- **GitHub ID writeback**: After creating, writes the GitHub issue/milestone number back into the entity's frontmatter
- **Milestone linking**: Resolves epic `milestone_ref` IDs to GitHub milestone numbers
- **Status mapping**: `done`/`cancelled` → close the issue; other statuses → open

---

## Diff Engine

Field-level diffing between local entities and GitHub resources.

### Hash-Based Fast Path

```typescript
export function diffByHash(
  currentLocalHash: string,
  currentRemoteHash: string,
  stateEntry: SyncStateEntry,
): 'in_sync' | 'local_changed' | 'remote_changed' | 'both_changed' {
  const localChanged = currentLocalHash !== stateEntry.local_hash;
  const remoteChanged = currentRemoteHash !== stateEntry.remote_hash;

  if (!localChanged && !remoteChanged) return 'in_sync';
  if (localChanged && !remoteChanged)  return 'local_changed';
  if (!localChanged && remoteChanged)  return 'remote_changed';
  return 'both_changed';
}
```

### Field-Level Diff

When both sides changed, the diff engine compares individual fields:

```typescript
export function diffEntity(
  local: ParsedEntity,
  remoteFields: Record<string, unknown>,
  baselineLocal: Record<string, unknown>,
  baselineRemote: Record<string, unknown>,
): DiffResult {
  // Returns: status, localChanges[], remoteChanges[], conflicts[]
}
```

| DiffResult Status | Meaning |
|-------------------|---------|
| `in_sync` | No changes on either side |
| `local_changed` | Only local side has changes → push to GitHub |
| `remote_changed` | Only remote side has changes → pull to local |
| `conflict` | Same field changed on both sides → needs resolution |

### Comparable Fields

For stories/epics:
```
title, status, priority, assignee/owner, labels (sorted), body (trimmed)
```

For milestones:
```
title, status, target_date, body (trimmed)
```

### Diff Test Output

```
 ✓ remoteIssueFields
   ✓ extracts comparable fields from a GitHub issue
   ✓ maps closed state to done
   ✓ filters out epic label
 ✓ remoteMilestoneFields
   ✓ extracts comparable fields from a GitHub milestone
   ✓ maps closed state to done
 ✓ diffEntity
   ✓ detects in_sync when nothing changed
   ✓ detects local-only changes
   ✓ detects remote-only changes
   ✓ detects conflicts when same field changed on both sides
   ✓ does not conflict when both changed to same value
 ✓ diffByHash
   ✓ returns in_sync when hashes match
   ✓ returns local_changed when only local changed
   ✓ returns remote_changed when only remote changed
   ✓ returns both_changed when both changed
```

---

## Conflict Resolution

### Strategies

Three conflict resolution strategies:

| Strategy | Behavior |
|----------|----------|
| `local-wins` | All conflicts resolved in favor of local values |
| `remote-wins` | All conflicts resolved in favor of remote values |
| `ask` | Returns unresolved — CLI (Phase 5) handles interactive prompting |

### Implementation

```typescript
export function resolveConflicts(
  conflicts: FieldConflict[],
  strategy: ConflictStrategy,
): Resolution[] {
  if (strategy === 'ask') return [];  // CLI handles this
  const pick = strategy === 'local-wins' ? 'local' : 'remote';
  return conflicts.map((c) => ({ entityId: c.entityId, field: c.field, pick }));
}
```

### Resolution Application

```typescript
export function applyResolutions(
  localFields: Record<string, unknown>,
  remoteFields: Record<string, unknown>,
  conflicts: FieldConflict[],
  resolutions: Resolution[],
): Record<string, unknown> {
  // Merges resolved values into a single field map
}
```

### Conflict Test Output

```
 ✓ resolveConflicts
   ✓ resolves all conflicts to local with local-wins strategy
   ✓ resolves all conflicts to remote with remote-wins strategy
   ✓ returns empty resolutions with ask strategy
   ✓ handles empty conflicts array
 ✓ applyResolutions
   ✓ keeps local values when pick is local
   ✓ applies remote values when pick is remote
   ✓ supports mixed resolution picks
```

---

## Bidirectional Sync

`syncWithGitHub()` combines pull and push into a single operation.

### Sync Flow

```
1. Load sync state (required — must import/export first)
2. Parse current local .meta/ tree
3. For each tracked entity:
   a. Compute current local hash
   b. Fetch current remote state from GitHub
   c. Compare hashes using diffByHash()
   d. in_sync → skip
   e. local_changed → push to GitHub
   f. remote_changed → pull to local files
   g. both_changed → apply conflict strategy
4. Handle new local entities (not in sync state) → create on GitHub
5. Handle locally deleted entities → close on GitHub
6. Update sync state
```

### Usage

```typescript
import { syncWithGitHub } from '@gitpm/sync-github';

const result = await syncWithGitHub({
  token: 'ghp_xxxx',
  repo: 'myorg/myrepo',
  metaDir: '.meta',
  strategy: 'local-wins',  // or 'remote-wins' or 'ask'
  dryRun: false,
});

if (result.ok) {
  const { pushed, pulled, conflicts, resolved, skipped } = result.value;
  console.log(`Pushed: ${pushed.milestones} milestones, ${pushed.issues} issues`);
  console.log(`Pulled: ${pulled.milestones} milestones, ${pulled.issues} issues`);
  console.log(`Conflicts: ${conflicts.length} (resolved: ${resolved}, skipped: ${skipped})`);
}
```

### SyncResult Type

```typescript
interface SyncResult {
  pushed: { milestones: number; issues: number };
  pulled: { milestones: number; issues: number };
  conflicts: FieldConflict[];
  resolved: number;
  skipped: number;
}
```

---

## Entity Deletion Handling

| Scenario | Behavior |
|----------|----------|
| Local file deleted, exists on GitHub | Close the GitHub issue/milestone (not delete) |
| GitHub issue closed/deleted, exists locally | Update local entity status to `cancelled` |
| Both deleted | Remove from sync state |

Actual file/issue deletion requires an explicit `gitpm prune` command (post-MVP).

---

## Client CRUD Operations

Phase 4 extends `GitHubClient` with six new methods:

```typescript
class GitHubClient {
  // Existing (Phase 3)
  async listMilestones(owner, repo): Promise<GhMilestone[]>
  async listIssues(owner, repo, options?): Promise<GhIssue[]>

  // New (Phase 4)
  async getIssue(owner, repo, issueNumber): Promise<GhIssue | null>
  async getMilestone(owner, repo, milestoneNumber): Promise<GhMilestone | null>
  async createIssue(owner, repo, params): Promise<GhIssue>
  async updateIssue(owner, repo, issueNumber, params): Promise<GhIssue>
  async createMilestone(owner, repo, params): Promise<GhMilestone>
  async updateMilestone(owner, repo, milestoneNumber, params): Promise<GhMilestone>
}
```

All methods include rate-limit checking via the existing `checkRateLimit()` mechanism.

---

## Type System

### New Types Added

```typescript
// Export
interface ExportOptions {
  token: string;
  repo: string;
  metaDir: string;
  projectNumber?: number;
  dryRun?: boolean;
}

interface ExportResult {
  created: { milestones: number; issues: number };
  updated: { milestones: number; issues: number };
  totalChanges: number;
}

// Sync
interface SyncOptions {
  token: string;
  repo: string;
  metaDir: string;
  strategy?: ConflictStrategy;
  dryRun?: boolean;
}

type ConflictStrategy = 'local-wins' | 'remote-wins' | 'ask';

interface SyncResult {
  pushed: { milestones: number; issues: number };
  pulled: { milestones: number; issues: number };
  conflicts: FieldConflict[];
  resolved: number;
  skipped: number;
}

// Diff
type DiffStatus = 'in_sync' | 'local_changed' | 'remote_changed' | 'conflict';

interface DiffResult {
  status: DiffStatus;
  localChanges: FieldChange[];
  remoteChanges: FieldChange[];
  conflicts: FieldConflict[];
}

interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

interface FieldConflict {
  entityId: string;
  entityTitle: string;
  entityType: string;
  field: string;
  baseValue: unknown;
  localValue: unknown;
  remoteValue: unknown;
}

interface Resolution {
  entityId: string;
  field: string;
  pick: 'local' | 'remote';
}
```

---

## Full Test Results

```
$ bun run test

 RUN  v2.1.9 /home/user/gitpm

 ✓ packages/sync-github/src/__tests__/diff.test.ts (14 tests) 10ms
 ✓ packages/sync-github/src/__tests__/state.test.ts (14 tests) 13ms
 ✓ packages/sync-github/src/__tests__/mapper.test.ts (20 tests) 10ms
 ✓ packages/core/src/schemas/__tests__/schemas.test.ts (20 tests) 17ms
 ✓ packages/sync-github/src/__tests__/import.test.ts (8 tests) 99ms
 ✓ packages/sync-github/src/__tests__/sync.test.ts (7 tests) 130ms
 ✓ packages/sync-github/src/__tests__/export.test.ts (4 tests) 81ms
 ✓ packages/core/src/validator/validator.test.ts (6 tests) 29ms
 ✓ packages/core/src/resolver/resolver.test.ts (11 tests) 57ms
 ✓ packages/sync-github/src/__tests__/conflict.test.ts (7 tests) 4ms
 ✓ packages/core/src/parser/parser.test.ts (10 tests) 43ms
 ✓ packages/core/src/writer/writer.test.ts (7 tests) 62ms
 ✓ packages/core/src/index.test.ts (1 test) 2ms

 Test Files  13 passed (13)
      Tests  129 passed (129)
   Duration  1.95s
```

### Phase 4 Tests Breakdown

| Test File | Tests | Time | Coverage |
|-----------|-------|------|----------|
| `diff.test.ts` | 14 | 10ms | Field extraction, diffEntity, diffByHash |
| `conflict.test.ts` | 7 | 4ms | All 3 strategies, resolution application |
| `export.test.ts` | 4 | 81ms | Export after import, dry run, state updates |
| `sync.test.ts` | 7 | 130ms | Sync lifecycle, strategies, local modifications |
| **Total** | **32** | **225ms** | |

---

## Build Output

```
$ bun run build

@gitpm/sync-github build: ESM dist/index.js 44.86 KB
@gitpm/sync-github build: ESM ⚡️ Build success in 23ms
@gitpm/sync-github build: DTS dist/index.d.ts 9.52 KB
@gitpm/sync-github build: DTS ⚡️ Build success in 2265ms
```

Package grew from 15.47 KB → 44.86 KB (ESM), types from 4.84 KB → 9.52 KB.

---

## How to Use

### Full Round-Trip Example

```typescript
import { importFromGitHub, exportToGitHub, syncWithGitHub } from '@gitpm/sync-github';

// Step 1: Initial import
const imported = await importFromGitHub({
  token: process.env.GITHUB_TOKEN!,
  repo: 'myorg/myrepo',
  metaDir: '.meta',
});

// Step 2: Make local edits to .meta/ files...

// Step 3: Push changes to GitHub
const exported = await exportToGitHub({
  token: process.env.GITHUB_TOKEN!,
  repo: 'myorg/myrepo',
  metaDir: '.meta',
});

// Step 4: Full bidirectional sync (after changes on both sides)
const synced = await syncWithGitHub({
  token: process.env.GITHUB_TOKEN!,
  repo: 'myorg/myrepo',
  metaDir: '.meta',
  strategy: 'local-wins',
});
```

### Dry Run Preview

```typescript
const preview = await exportToGitHub({
  token: process.env.GITHUB_TOKEN!,
  repo: 'myorg/myrepo',
  metaDir: '.meta',
  dryRun: true,  // no API calls made
});

if (preview.ok) {
  console.log(`Would create: ${preview.value.created.issues} issues`);
  console.log(`Would update: ${preview.value.updated.issues} issues`);
}
```

---

## What's Next

### Phase 5: @gitpm/cli — Sync Commands

- **`gitpm import`**: CLI wrapper for `importFromGitHub()`
- **`gitpm push`**: CLI wrapper for `exportToGitHub()` with `--dry-run`
- **`gitpm pull`**: Pull remote changes with conflict strategy selection
- **`gitpm sync`**: Full bidirectional sync with interactive conflict resolution
- **Auth flow**: `--token` flag → `GITHUB_TOKEN` env → `gh auth token` fallback
