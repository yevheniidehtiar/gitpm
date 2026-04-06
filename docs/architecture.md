# Architecture Overview

This document describes GitPM's system architecture, package structure, and code conventions. It is intended for contributors.

## System Architecture

```
┌─────────────────────────────────────────┐
│              gitpm CLI (TS)             │
├─────────────────────────────────────────┤
│       gitpm UI (React + Tailwind)       │
├──────────────┬──────────────────────────┤
│ Schema Engine│   Sync Adapters          │
│ @gitpm/core  │   @gitpm/sync-github     │
│              │   @gitpm/sync-gitlab     │
│              │   @gitpm/sync-jira       │
├──────────────┴──────────────────────────┤
│         .meta/ file tree (Git)          │
└─────────────────────────────────────────┘
```

## Packages

| Package | npm Name | Purpose | Key Dependencies |
|---------|----------|---------|-----------------|
| `packages/core` | `@gitpm/core` | Schema engine: parse, validate, resolve, write `.meta/` trees | `zod`, `yaml`, `gray-matter` |
| `packages/sync-github` | `@gitpm/sync-github` | Bidirectional sync with GitHub Issues/Milestones/Projects | `@octokit/rest`, `@gitpm/core` |
| `packages/sync-gitlab` | `@gitpm/sync-gitlab` | Bidirectional sync with GitLab Issues/Milestones | `@gitpm/core` |
| `packages/sync-jira` | `@gitpm/sync-jira` | Bidirectional sync with Jira Cloud | `@gitpm/core` |
| `packages/cli` | `gitpm` | CLI entry point with six commands | `commander`, `chalk`, `ora`, `@gitpm/core`, sync packages |
| `packages/ui` | `@gitpm/ui` | Local React web UI for browsing and editing | `react`, `tailwindcss`, `@tanstack/router`, `@tanstack/query`, `hono` |

### Dependency Graph

```
cli ─────┬──▶ core
         ├──▶ sync-github ──▶ core
         ├──▶ sync-gitlab ──▶ core
         └──▶ sync-jira ────▶ core

ui ──────┬──▶ core
         └──▶ (sync packages via API server)
```

## Data Flow

### Core Pipeline

The core package processes `.meta/` files through four stages:

```
.meta/ files
    │
    ▼
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│  Parser  │ ──▶ │ Resolver │ ──▶ │ Validator │ ──▶ │  Writer  │
│          │     │          │     │           │     │          │
│ Files →  │     │ Link     │     │ Check     │     │ Entities │
│ Entities │     │ cross-   │     │ integrity │     │ → Files  │
│          │     │ refs     │     │           │     │          │
└──────────┘     └──────────┘     └───────────┘     └──────────┘
```

- **Parser** (`parseTree`, `parseFile`): Reads `.meta/` files, splits YAML frontmatter from Markdown body using `gray-matter`, validates against Zod schemas, returns typed entities.
- **Resolver** (`resolveRefs`): Walks all entities, matches `EntityRef` fields to actual entities by ID, populates reverse references (e.g., an epic's stories list).
- **Validator** (`validateTree`): Checks for duplicate IDs, orphaned references, circular dependencies, and status inconsistencies (e.g., epic marked `done` with `in_progress` stories).
- **Writer** (`writeTree`, `writeFile`): Serializes entities back to Markdown files with YAML frontmatter. Round-trips are lossless.

### Sync Engine

Each sync adapter (GitHub, GitLab, Jira) follows the same three-flow pattern:

**Import (remote to local):**
1. Fetch milestones and issues from the remote platform
2. Map remote entities to GitPM types (Story, Epic, Milestone)
3. Generate entity IDs and cross-references
4. Write to `.meta/` via the core writer
5. Create sync state and config files

**Export (local to remote):**
1. Parse local `.meta/` tree
2. Compare content hashes against sync state
3. Create or update remote issues/milestones for changed entities
4. Update sync state with new hashes

**Bidirectional Sync:**
1. Load sync state (content hashes from last sync)
2. Parse local tree and fetch remote state
3. Compute three-way diff: base (last sync) vs local vs remote
4. Apply non-conflicting changes automatically
5. Resolve conflicts per chosen strategy (`local-wins`, `remote-wins`, `ask`)
6. Update both local files and remote entities
7. Persist updated sync state

### Conflict Detection

The sync engine uses SHA-256 content hashes for change detection. For each entity, it compares:

- **Local hash** vs **base hash** (from last sync) to detect local changes
- **Remote hash** vs **base hash** to detect remote changes
- If both sides changed, it's a **conflict** requiring resolution

Field-level diffing identifies exactly which fields changed (title, status, priority, assignee, labels, body).

## Directory Structure

```
gitpm/
├── CLAUDE.md                    # Project conventions (this file)
├── package.json                 # Bun workspace root
├── biome.json                   # Linting config
├── vitest.config.ts             # Test config
├── tsconfig.json                # Base TypeScript config
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── schemas/         # Zod schemas for all entity types
│   │       ├── parser/          # File → entity parsing
│   │       ├── writer/          # Entity → file serialization
│   │       ├── resolver/        # Cross-reference & dependency graph
│   │       ├── validator/       # Tree-wide validation
│   │       └── __fixtures__/    # Test fixture .meta/ trees
│   ├── sync-github/
│   │   └── src/
│   │       ├── client.ts        # Octokit wrapper with rate limiting
│   │       ├── mapper.ts        # GitHub ↔ GitPM entity mapping
│   │       ├── import.ts        # GitHub → .meta/ flow
│   │       ├── export.ts        # .meta/ → GitHub flow
│   │       ├── sync.ts          # Bidirectional sync
│   │       ├── diff.ts          # Field-level diffing
│   │       ├── conflict.ts      # Conflict detection & resolution
│   │       ├── state.ts         # Sync state management
│   │       ├── config.ts        # Config file management
│   │       └── linker.ts        # Epic-story linkage detection
│   ├── sync-gitlab/             # Same structure as sync-github
│   ├── sync-jira/               # Same structure as sync-github
│   ├── cli/
│   │   └── src/
│   │       ├── index.ts         # Commander setup
│   │       ├── commands/        # init, validate, import, push, pull, sync
│   │       └── utils/           # auth, config, output, conflict-ui
│   └── ui/
│       └── src/
│           ├── routes/          # tree-browser, entity-editor, roadmap, sync-dashboard
│           ├── components/      # StatusBadge, PriorityBadge, etc.
│           ├── lib/api.ts       # React Query hooks
│           └── server/          # Hono API server
└── docs/
    ├── demo.md                  # Product demo & use cases
    ├── architecture.md          # This file
    ├── cli-reference.md
    ├── schema-reference.md
    ├── sync-guide.md
    ├── migration-guide.md
    └── schemas/ENTITY_SCHEMAS.md
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| **Bun** | Package manager, script runner, test runner |
| **TypeScript** | Language (strict mode, ESM only) |
| **Zod** | Schema validation for all entity types |
| **gray-matter** | YAML frontmatter parsing |
| **yaml** | YAML serialization |
| **Commander** | CLI framework |
| **chalk** | Terminal colors |
| **ora** | Terminal spinners |
| **@octokit/rest** | GitHub API client |
| **React 18** | UI framework |
| **Tailwind CSS** | UI styling |
| **TanStack Router** | Client-side routing |
| **TanStack Query** | API state management |
| **Hono** | Lightweight API server for UI backend |
| **Vite** | UI build tool and dev server |
| **tsup** | Package build tool |
| **Vitest** | Test framework |
| **Biome** | Linter and formatter |

## Code Conventions

### Error Handling

Library code uses `Result<T, E>` types instead of thrown exceptions:

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
```

### Imports

- ESM only (`import`/`export`, no `require`)
- File extensions in imports: `.js` (TypeScript outputs)
- Prefer `type` imports: `import type { X } from '...'`

### Schemas

- All validation uses Zod schemas — no manual type guards
- Each schema exports both the Zod object and the inferred TypeScript type:
  ```typescript
  export const storyFrontmatterSchema = z.object({ ... });
  export type StoryFrontmatter = z.infer<typeof storyFrontmatterSchema>;
  ```

### Style

- Prefer functions and plain objects over classes
- File I/O uses `node:fs/promises` (Bun-compatible)
- 2-space indentation, single quotes, trailing commas (enforced by Biome)
- Tests colocated as `*.test.ts` next to source files

## Testing

### Strategy

- **Unit tests** for every public function in `core` and sync packages
- **Integration tests** for sync packages using fixture files (no live API calls in CI)
- **E2E tests** for CLI commands using temporary directories
- **Fixtures** in `packages/core/src/__fixtures__/` with valid and broken `.meta/` trees

### Running Tests

```bash
# Run all tests
bun run test

# Run tests for a specific package
bun run test -- --filter core

# Run a specific test file
bun run test -- packages/core/src/parser/parser.test.ts

# Watch mode
bun run test -- --watch
```

### Build

```bash
# Build all packages
bun run build

# Lint
bun run lint

# Auto-fix lint issues
bunx biome check --write .
```

**Important:** `sync-github` tests import `@gitpm/core` which resolves to `dist/index.js`. You must build before testing:

```bash
bun run build && bun run test
```
