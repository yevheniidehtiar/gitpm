# GitPM — Phase 1 Demo: @gitpm/core Schema Engine

> **Status**: Complete | **Tests**: 55 passed | **Build**: Passing | **Files**: 30 source files

---

## Table of Contents

- [Overview](#overview)
- [Entity Schemas](#entity-schemas)
- [File Parser](#file-parser)
- [Entity Writer](#entity-writer)
- [Cross-Reference Resolver](#cross-reference-resolver)
- [Dependency Graph](#dependency-graph)
- [Tree Validator](#tree-validator)
- [Test Fixtures](#test-fixtures)
- [Full Test Results](#full-test-results)
- [How to Use](#how-to-use)
- [What's Next](#whats-next)

---

## Overview

Phase 1 implements the **schema engine** — the heart of GitPM. It turns a `.meta/` file tree into validated, type-safe entity objects with resolved cross-references and dependency analysis.

```
.meta/ files  ──→  Parser  ──→  MetaTree  ──→  Resolver  ──→  ResolvedTree  ──→  Validator
  (YAML/MD)         │              │               │                │                │
                    │         Zod Schemas     Ref Resolution    Dep. Graph      Errors/Warnings
                    │                              │
                    └── Writer ◄───────────────────┘
                    (round-trip lossless serialization)
```

---

## Entity Schemas

All entities are defined with **Zod** schemas for runtime validation and automatic TypeScript type inference.

### Common Types

```typescript
// Status workflow: backlog → todo → in_progress → in_review → done (or cancelled)
export const statusSchema = z.enum([
  'backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled',
]);

// Priority levels
export const prioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

// Cross-entity references
export const entityRefSchema = z.object({
  id: entityIdSchema,
  path: z.string().optional(),
});

// GitHub sync metadata
export const gitHubSyncSchema = z.object({
  issue_number: z.number().int().optional(),
  project_item_id: z.string().optional(),
  milestone_id: z.number().int().optional(),
  repo: z.string(),
  last_sync_hash: z.string(),
  synced_at: z.string(),
});

// Functional error handling — no thrown exceptions
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

### Story Schema (Example Entity)

```typescript
export const storyFrontmatterSchema = z.object({
  type: z.literal('story'),
  id: entityIdSchema,
  title: z.string().min(1),
  status: statusSchema,
  priority: prioritySchema,
  assignee: z.string().nullable().optional(),
  labels: z.array(z.string()).default([]),
  estimate: z.number().nullable().optional(),
  epic_ref: entityRefSchema.nullable().optional(),
  github: gitHubSyncSchema.nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const storySchema = storyFrontmatterSchema.extend({
  body: z.string().default(''),
  filePath: z.string(),
});

// TypeScript types inferred automatically
export type Story = z.infer<typeof storySchema>;
```

### All 5 Entity Types

| Entity | Schema | Fields | File Format |
|--------|--------|--------|-------------|
| **Story** | `storySchema` | id, title, status, priority, assignee, labels, estimate, epic_ref | Markdown + frontmatter |
| **Epic** | `epicSchema` | id, title, status, priority, owner, labels, milestone_ref | Markdown + frontmatter |
| **Milestone** | `milestoneSchema` | id, title, status, due_date, description | Markdown + frontmatter |
| **Roadmap** | `roadmapSchema` | id, title, description, milestones | YAML only |
| **PRD** | `prdSchema` | id, title, status, priority, owner, labels, epic_refs | Markdown + frontmatter |

---

## File Parser

The parser reads `.meta/` files and converts them into typed entities using Zod validation.

### How It Works

1. **Detect format**: `.yaml` → pure YAML | `.md` → frontmatter + body (via `gray-matter`)
2. **Extract type**: Read the `type` field from frontmatter/YAML
3. **Validate**: Run through the corresponding Zod schema
4. **Return**: `Result<ParsedEntity>` — success with typed data or error with details

### Example: Parsing an Epic

Given this file (`.meta/epics/balancing-engine/epic.md`):

```markdown
---
type: epic
id: ep_balancing
title: Balancing Engine v1
status: in_progress
priority: critical
owner: dmytro
labels:
  - core
  - q2-2026
milestone_ref:
  id: ms_q2_launch
created_at: 2026-02-15T09:00:00Z
updated_at: 2026-03-15T10:00:00Z
---

## Overview

Build the core balancing engine that optimizes energy dispatch.
```

The parser produces:

```typescript
{
  ok: true,
  value: {
    type: 'epic',
    id: 'ep_balancing',
    title: 'Balancing Engine v1',
    status: 'in_progress',
    priority: 'critical',
    owner: 'dmytro',
    labels: ['core', 'q2-2026'],
    milestone_ref: { id: 'ms_q2_launch' },
    body: '## Overview\n\nBuild the core balancing engine...',
    filePath: '.meta/epics/balancing-engine/epic.md'
  }
}
```

### Tree Parser

`parseTree()` recursively scans a `.meta/` directory, parses every `.md` and `.yaml` file, and organizes results by type:

```typescript
const result = await parseTree('/path/to/.meta');
if (result.ok) {
  console.log(result.value.stories);    // Story[]
  console.log(result.value.epics);      // Epic[]
  console.log(result.value.milestones); // Milestone[]
  console.log(result.value.roadmaps);   // Roadmap[]
  console.log(result.value.prds);       // PRD[]
  console.log(result.value.errors);     // ParseError[] (partial failures)
}
```

---

## Entity Writer

The writer serializes entities back to files — **lossless round-trip** guaranteed.

### Capabilities

- **`writeFile(entity, path)`** — Serialize a single entity to YAML frontmatter + Markdown body
- **`writeTree(tree, dir)`** — Write an entire MetaTree to disk, creating directories as needed
- **`scaffoldMeta(dir, name)`** — Generate a starter `.meta/` tree with sample entities
- **`toSlug(title)`** — Convert titles to filesystem-safe slugs

### Round-Trip Demo

```
Original File → parseFile() → Entity Object → writeFile() → Output File
                                                              ↓
                                              Files are byte-identical ✓
```

This is validated by the test suite — parse a fixture tree, write to a temp directory, parse again, and deep-compare.

---

## Cross-Reference Resolver

Entities reference each other via `EntityRef` objects (e.g., a Story's `epic_ref` points to an Epic's `id`). The resolver **resolves these into actual entity objects** and builds reverse references.

### Reference Chain

```
Story.epic_ref.id ──────→ Epic
Epic.milestone_ref.id ──→ Milestone
Roadmap.milestones[].id → Milestone[]
PRD.epic_refs[].id ─────→ Epic[]
```

### Resolved Output

After resolution, entities gain populated reference fields:

```typescript
// ResolvedEpic has .resolvedStories and .resolvedMilestone
epic.resolvedStories    // → [Story, Story]  (reverse refs from stories)
epic.resolvedMilestone  // → Milestone       (forward ref resolved)

// ResolvedRoadmap has .resolvedMilestones
roadmap.resolvedMilestones // → [Milestone, Milestone]
```

Unresolved references are collected as errors rather than throwing exceptions.

---

## Dependency Graph

The resolver builds a **directed acyclic graph (DAG)** of entity dependencies with two key algorithms:

### Implementation

```typescript
export function buildDependencyGraph(tree: ResolvedTree): DependencyGraph {
  const adjacency = new Map<EntityId, EntityId[]>();

  // Edges: child → parent (story → epic, epic → milestone, etc.)
  for (const s of tree.stories) {
    if (s.resolvedEpic) adjacency.get(s.id)?.push(s.resolvedEpic.id);
  }
  for (const e of tree.epics) {
    if (e.resolvedMilestone) adjacency.get(e.id)?.push(e.resolvedMilestone.id);
  }
  // ...

  return {
    adjacency,
    topologicalSort(): EntityId[] { /* ... */ },
    findCycles(): EntityId[][] { /* ... */ },
  };
}
```

### Features

| Method | Purpose | Algorithm |
|--------|---------|-----------|
| `topologicalSort()` | Ordered list of entity IDs respecting dependencies | DFS post-order |
| `findCycles()` | Detect circular dependencies | DFS with recursion stack |

---

## Tree Validator

The validator runs **tree-wide consistency checks** on a resolved tree.

### Validation Rules

| Rule | Code | Description |
|------|------|-------------|
| Orphaned refs | `UNRESOLVED_REF` | EntityRef points to non-existent ID |
| Duplicate IDs | `DUPLICATE_ID` | Same ID used by multiple entities |
| Circular deps | `CIRCULAR_DEPENDENCY` | Cycle detected in dependency graph |
| Status consistency | `STATUS_INCONSISTENCY` | Epic marked "done" with active stories (error) or "cancelled" with active stories (warning) |

### Example Output

**Valid tree:**
```typescript
validateTree(resolvedTree)
// → { valid: true, errors: [], warnings: [] }
```

**Broken tree (fixture with intentional errors):**
```typescript
validateTree(brokenTree)
// → {
//     valid: false,
//     errors: [
//       { code: 'UNRESOLVED_REF', message: 'Ref "nonexistent_id" not found...' },
//       { code: 'DUPLICATE_ID', message: 'Duplicate entity ID "dup_id"...' }
//     ],
//     warnings: []
//   }
```

---

## Test Fixtures

### Valid Tree Structure

A complete `.meta/` directory used for testing:

```
.meta/
├── roadmap/
│   ├── roadmap.yaml              # Main roadmap with 2 milestone refs
│   └── milestones/
│       ├── q2-launch.md          # Milestone: Q2 2026 Launch
│       └── q3-scale.md           # Milestone: Q3 2026 Scale
├── epics/
│   └── balancing-engine/
│       ├── epic.md               # Epic: Balancing Engine v1
│       └── stories/
│           ├── price-feed-ingestion.md  # Story under epic
│           └── optimization-solver.md   # Story under epic
├── stories/
│   └── setup-ci.md               # Orphan story (no epic)
└── prds/
    └── balancing-v1/
        └── prd.md                # PRD referencing the epic
```

### Sample Roadmap (YAML)

```yaml
type: roadmap
id: rm_main
title: GitPM Product Roadmap
description: Main product roadmap for 2026
milestones:
  - id: ms_q2_launch
  - id: ms_q3_scale
updated_at: 2026-03-15T10:00:00Z
```

### Sample Epic (Markdown + Frontmatter)

```markdown
---
type: epic
id: ep_balancing
title: Balancing Engine v1
status: in_progress
priority: critical
owner: dmytro
labels: [core, q2-2026]
milestone_ref:
  id: ms_q2_launch
---

## Overview

Build the core balancing engine that optimizes energy dispatch.
```

---

## Full Test Results

```
$ bun run test

 RUN  v2.1.9 /home/user/gitpm

 ✓ packages/core/src/schemas/__tests__/schemas.test.ts  (20 tests)  25ms
 ✓ packages/core/src/validator/validator.test.ts         (6 tests)  28ms
 ✓ packages/core/src/resolver/resolver.test.ts          (11 tests)  54ms
 ✓ packages/core/src/parser/parser.test.ts              (10 tests)  33ms
 ✓ packages/core/src/writer/writer.test.ts               (7 tests)  61ms
 ✓ packages/core/src/index.test.ts                       (1 test)    2ms

 Test Files  6 passed (6)
      Tests  55 passed (55)
   Start at  10:55:31
   Duration  910ms (transform 265ms, setup 0ms, collect 899ms, tests 202ms, environment 2ms, prepare 376ms)
```

### Test Breakdown

| Test Suite | Tests | What's Covered |
|-----------|-------|----------------|
| **Schemas** | 20 | Valid/invalid data for all 5 entity types (2+ per type) |
| **Parser** | 10 | File parsing, tree parsing, valid & broken fixtures |
| **Writer** | 7 | Serialization, round-trip lossless tests, scaffolding |
| **Resolver** | 11 | Ref resolution, reverse refs, broken refs, graph building |
| **Validator** | 6 | All validation rules, status consistency checks |
| **Index** | 1 | Public API exports |

---

## How to Use

### Parse a `.meta/` tree

```typescript
import { parseTree, resolveRefs, validateTree } from '@gitpm/core';

// 1. Parse all files
const parsed = await parseTree('/path/to/repo/.meta');
if (!parsed.ok) throw parsed.error;

// 2. Resolve cross-references
const resolved = resolveRefs(parsed.value);
if (!resolved.ok) throw resolved.error;

// 3. Validate the tree
const validation = validateTree(resolved.value);
if (!validation.valid) {
  for (const err of validation.errors) {
    console.error(`[${err.code}] ${err.message}`);
  }
}
```

### Scaffold a new `.meta/` directory

```typescript
import { scaffoldMeta } from '@gitpm/core';

const result = await scaffoldMeta('/path/to/repo/.meta', 'My Project');
// Creates a complete starter .meta/ tree with sample entities
```

### Write entities back to files

```typescript
import { writeFile } from '@gitpm/core';

await writeFile(storyEntity, '/path/to/.meta/stories/my-story.md');
// Serializes entity as YAML frontmatter + Markdown body
```

---

## What's Next

**Phase 2: @gitpm/cli — Init & Validate Commands** wraps the core engine in a CLI:

- `gitpm init` — Interactive project initialization, creates `.meta/` tree
- `gitpm validate` — Run validation and report errors with colored output
- Pretty terminal output with `chalk` and `ora` spinners
- Help text and usage instructions

The core engine built in Phase 1 provides all the heavy lifting — Phase 2 simply exposes it through a developer-friendly CLI interface.
