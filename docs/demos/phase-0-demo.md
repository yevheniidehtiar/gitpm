# GitPM — Phase 0 Demo: Scaffold Monorepo

> **Status**: Complete | **Packages**: 4 | **Build**: Passing | **Lint**: Passing

---

## Table of Contents

- [Overview](#overview)
- [Workspace Architecture](#workspace-architecture)
- [Package Structure](#package-structure)
- [Configuration](#configuration)
- [Build Output](#build-output)
- [Lint Output](#lint-output)
- [How to Use](#how-to-use)
- [What's Next](#whats-next)

---

## Overview

Phase 0 establishes the Bun monorepo foundation for GitPM — four workspace packages with shared TypeScript config, Biome linting, and Vitest testing. Every subsequent phase builds on this scaffold.

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

---

## Workspace Architecture

The monorepo uses **Bun workspaces** to manage four packages with cross-dependencies:

```
gitpm/
├── package.json              # Workspace root
├── tsconfig.json             # Base TypeScript config (strict, ESM)
├── biome.json                # Linting & formatting rules
├── vitest.config.ts          # Test runner config
├── packages/
│   ├── core/                 # @gitpm/core — schema engine
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/index.ts
│   ├── sync-github/          # @gitpm/sync-github — GitHub adapter
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/index.ts
│   ├── cli/                  # gitpm — CLI entry point
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/index.ts
│   └── ui/                   # @gitpm/ui — React web interface
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/main.tsx
└── docs/
    └── IMPLEMENTATION_PLAN.md
```

---

## Package Structure

### Root `package.json`

```json
{
  "name": "gitpm-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "bun run --filter '*' build",
    "test": "vitest run",
    "lint": "biome check .",
    "dev:ui": "bun run --filter @gitpm/ui dev"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

### Package Dependencies

| Package | Name | Key Dependencies |
|---------|------|-----------------|
| `core` | `@gitpm/core` | `zod`, `yaml`, `gray-matter`, `nanoid` |
| `sync-github` | `@gitpm/sync-github` | `@gitpm/core`, `@octokit/rest` |
| `cli` | `gitpm` | `@gitpm/core`, `@gitpm/sync-github`, `commander`, `chalk`, `ora` |
| `ui` | `@gitpm/ui` | `@gitpm/core`, `react`, `tailwindcss`, `@tanstack/react-router` |

---

## Configuration

### TypeScript — Strict ESM

Base `tsconfig.json` enforces strict mode and ESM-only:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

### Biome — Linting & Formatting

```json
{
  "formatter": { "indentStyle": "space", "indentWidth": 2 },
  "javascript": {
    "formatter": { "quoteStyle": "single", "trailingCommas": "all" }
  },
  "linter": {
    "rules": {
      "style": { "noNonNullAssertion": "warn", "useConst": "error" }
    }
  }
}
```

---

## Build Output

All four packages compile successfully with `tsup` (libraries) and `vite` (UI):

```
$ bun run build

@gitpm/core build: CLI tsup v8.5.1
@gitpm/core build: ESM dist/index.js 20.20 KB
@gitpm/core build: ESM ⚡️ Build success in 17ms
@gitpm/core build: DTS dist/index.d.ts 25.40 KB
@gitpm/core build: DTS ⚡️ Build success in 1748ms

@gitpm/sync-github build: CLI tsup v8.5.1
@gitpm/sync-github build: ESM dist/index.js 82.00 B
@gitpm/sync-github build: ESM ⚡️ Build success in 20ms

@gitpm/ui build: vite v6.4.1 building for production...
@gitpm/ui build: ✓ 24 modules transformed.
@gitpm/ui build: dist/index.html                  0.32 kB │ gzip:  0.23 kB
@gitpm/ui build: dist/assets/index-CrU92ic6.js  143.73 kB │ gzip: 46.16 kB
@gitpm/ui build: ✓ built in 887ms

gitpm build: CLI tsup v8.5.1
gitpm build: ESM dist/index.js 76.00 B
gitpm build: ESM ⚡️ Build success in 9ms
```

---

## Lint Output

Biome checks 49 files with only 1 minor warning (React's `createRoot` non-null assertion — expected pattern):

```
$ bun run lint

Checked 49 files in 21ms. No fixes applied.
Found 1 warning.
```

---

## How to Use

```bash
# Clone and install
git clone https://github.com/yevheniidehtiar/gitpm.git
cd gitpm
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Lint code
bun run lint

# Start UI dev server
bun run dev:ui
```

---

## What's Next

**Phase 1: @gitpm/core — Schema Engine** builds on this scaffold to implement:
- Zod schemas for all entity types (Story, Epic, Milestone, Roadmap, PRD)
- File parser (Markdown frontmatter + YAML)
- Entity writer (round-trip serialization)
- Cross-reference resolver with dependency graph
- Tree-wide validator

See [Phase 1 Demo](./phase-1-demo.md) →
