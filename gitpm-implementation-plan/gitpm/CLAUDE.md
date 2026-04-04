# GitPM — Git-Native Project Management

## Project Overview

GitPM is a developer tool that turns a Git monorepo's file tree into a full project management system, synchronized bidirectionally with GitHub (Projects, Issues, Milestones). The core idea: `.meta/` directory in any repo becomes the canonical store for roadmaps, PRDs, epics, and stories — editable by humans via UI, by AI agents via files, and kept in sync with GitHub.

## Architecture

```
┌─────────────────────────────────────────┐
│              gitpm CLI (TS)             │
├─────────────────────────────────────────┤
│       gitpm UI (React + Tailwind)       │
├──────────────┬──────────────────────────┤
│ Schema Engine│   GitHub Sync Engine     │
│ @gitpm/core  │   @gitpm/sync-github    │
├──────────────┴──────────────────────────┤
│         .meta/ file tree (Git)          │
└─────────────────────────────────────────┘
```

## Tech Stack

- **Runtime**: Bun (package manager, test runner, script runner)
- **Language**: TypeScript (strict mode, ESM only)
- **Monorepo**: Bun workspaces
- **Packages**:
  - `packages/core` — schema engine (zero dependencies beyond `yaml`, `gray-matter`, `zod`)
  - `packages/sync-github` — GitHub sync adapter (depends on `@octokit/rest`, `@gitpm/core`)
  - `packages/ui` — React app (`react`, `react-dom`, `tailwindcss`, `@tanstack/router`, `@tanstack/query`)
  - `packages/cli` — CLI entry point (`commander`, `chalk`, `ora`)
- **Linting**: Biome
- **Testing**: Vitest
- **Build**: `tsup` for packages, `vite` for UI

## Code Conventions

- All imports use ESM (`import`/`export`, no `require`)
- File extensions in imports: `.js` (TypeScript outputs)
- Prefer `type` imports where possible: `import type { X } from ...`
- Use `zod` for all schema validation — no manual type guards
- Error handling: return `Result<T, E>` types (no thrown exceptions in library code). Define as:
  ```ts
  type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
  ```
- File I/O: use `node:fs/promises` (Bun-compatible)
- Tests: colocated as `*.test.ts` next to source files
- No classes unless genuinely needed — prefer functions and plain objects

## Directory Structure

```
gitpm/
├── CLAUDE.md                    # This file
├── package.json                 # Workspace root
├── biome.json
├── vitest.config.ts
├── tsconfig.json                # Base tsconfig
├── packages/
│   ├── core/                    # @gitpm/core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── schemas/         # Zod schemas for all entity types
│   │   │   ├── parser/          # File → entity parsing
│   │   │   ├── writer/          # Entity → file serialization
│   │   │   ├── resolver/        # Cross-reference & dependency graph
│   │   │   └── validator/       # Tree-wide validation
│   │   └── src/__tests__/
│   ├── sync-github/             # @gitpm/sync-github
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── import.ts        # GitHub → .meta (Flow 1)
│   │   │   ├── export.ts        # .meta → GitHub (Flow 2)
│   │   │   ├── sync.ts          # Bidirectional sync logic
│   │   │   ├── diff.ts          # Field-level diffing
│   │   │   ├── conflict.ts      # Conflict detection & resolution
│   │   │   ├── state.ts         # Sync state management
│   │   │   └── mapper.ts        # Entity ↔ GitHub resource mapping
│   │   └── src/__tests__/
│   ├── cli/                     # gitpm CLI
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts         # Entry point
│   │       ├── commands/
│   │       │   ├── init.ts
│   │       │   ├── import.ts
│   │       │   ├── push.ts
│   │       │   ├── pull.ts
│   │       │   ├── sync.ts
│   │       │   └── validate.ts
│   │       └── utils/
│   └── ui/                      # @gitpm/ui
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── routes/
│           ├── components/
│           ├── hooks/
│           └── lib/
└── docs/
    ├── IMPLEMENTATION_PLAN.md   # Full phased plan
    └── schemas/                 # Schema reference docs
```

## Implementation Phases

Read `docs/IMPLEMENTATION_PLAN.md` for the full phased breakdown. Summary:

1. **Phase 0**: Scaffold monorepo, configure tooling
2. **Phase 1**: `@gitpm/core` — schemas, parser, writer, resolver, validator
3. **Phase 2**: `@gitpm/cli` — `init`, `validate` commands
4. **Phase 3**: `@gitpm/sync-github` — import from GitHub (Flow 1)
5. **Phase 4**: `@gitpm/sync-github` — export to GitHub (Flow 2) + bidirectional sync
6. **Phase 5**: `@gitpm/cli` — `import`, `push`, `pull`, `sync` commands
7. **Phase 6**: `@gitpm/ui` — local web UI

## Testing Strategy

- Unit tests for every public function in `core` and `sync-github`
- Integration tests for sync-github using fixture files (no live API in CI)
- E2E tests for CLI commands using a temp directory with a mock `.meta` tree
- UI: no tests in MVP (manual QA is sufficient at this stage)

## Commands Reference

```bash
bun install              # Install all dependencies
bun run build            # Build all packages
bun run test             # Run all tests
bun run lint             # Lint with Biome
bun run dev:ui           # Start UI dev server
```
