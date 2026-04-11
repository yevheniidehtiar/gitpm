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
    ├── demo.md                  # Product demo & use cases
    ├── architecture.md          # System design & conventions
    ├── cli-reference.md         # CLI command reference
    ├── schema-reference.md      # Entity type reference
    ├── sync-guide.md            # Sync configuration guide
    ├── migration-guide.md       # Migration from other tools
    └── schemas/                 # Schema reference docs
```

## Testing Strategy

- Unit tests for every public function in `core` and `sync-github`
- Integration tests for sync-github using fixture files (no live API in CI)
- E2E tests for CLI commands using a temp directory with a mock `.meta` tree
- UI: manual QA (no automated UI tests yet)

## Commands Reference

```bash
bun install              # Install all dependencies
bun run build            # Build all packages
bun run test             # Run all tests
bun run lint             # Lint with Biome
bun run dev:ui           # Start UI dev server
```

## CI/CD

GitHub Actions workflows live in `.github/workflows/`. After pushing, verify all checks pass on the PR.

**Pre-push checklist** — run locally before pushing:
```bash
bun run lint && bun run build && bun run test
```

**Known issues & fixes:**
- **Tests fail with import errors for `@gitpm/core`**: `sync-github` tests import `@gitpm/core` which resolves to `dist/index.js`. You must build before testing: `bun run build && bun run test`.
- **Biome formatting failures**: Run `bunx biome check --write .` to auto-fix. The project uses 2-space indentation (no tabs).
- **`--frozen-lockfile` fails in CI**: The `bun.lock` format varies across Bun versions. CI uses `bun install` without `--frozen-lockfile` to avoid version mismatches.

## Review Workflow

Use this checklist when reviewing a PR or a local change.

1. **Diff scan** — read the full diff, not just the latest commit. Look for: violations of the Code Conventions above (thrown exceptions in library code, `any`, manual type guards, `require`, missing `.js` in imports), missing colocated `*.test.ts`, unused exports, and dead branches.
2. **Second opinion** — for non-trivial changes, launch the `simplify` skill on the changed files to catch reuse opportunities and unnecessary complexity. For architectural changes, launch the `Plan` agent to double-check the approach.
3. **CI signal** — use the GitHub MCP tools (`mcp__github__pull_request_read`, `list_commits`) to verify checks are green before approving.
4. **Comment frugality** — only post review comments when they are actionable. Silent reads are fine. Avoid nits and style comments unless Biome would flag them.

Preferred commands: `/review-pr <number>` for structured PR reviews, `simplify` skill for local change review.

## Release Workflow

Releases are **fully automated via release-please and tag-triggered npm publish**. Do not tag or `npm publish` manually.

**Pre-push checklist (run before every push):**
```bash
bun run lint && bun run build && bun run test
```

**Conventional commits → release-please version bump mapping**

| Commit prefix | Version bump (pre-1.0) | When to use |
|---|---|---|
| `fix:` / `fix(scope):` | patch | bugfix |
| `feat:` / `feat(scope):` | patch (via `bump-patch-for-minor-pre-major`) | new capability |
| `feat!:` or `BREAKING CHANGE:` in body | major | incompatible change |
| `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `style:`, `build:`, `perf:` | none | housekeeping |

Release-please is configured **per-package** with `include-component-in-tag: true` (see `release-please-config.json`). Only packages that receive a `fix:` / `feat:` commit will bump; other packages stay at their current version. Use a scope when the change is isolated to one package: `fix(sync-gitlab): ...` bumps only `@gitpm/sync-gitlab`.

**Release flow:**
1. Commit to a feature branch using conventional commits.
2. Open a PR to `master`. CI runs `pr-validation.yml`.
3. A maintainer merges the PR.
4. `release-please.yml` opens or updates a "release PR" on `master` with version bumps + CHANGELOG entries.
5. A maintainer merges the release PR. This tags each bumped package (`@gitpm/<name>@vX.Y.Z`).
6. `release.yml` fires on tag push and runs `npm publish --access public` for every package.

Never merge a release PR without verifying the predicted versions match expectations. Use `/prepare-release` to audit commits since the last tag and preview what release-please will do.

## Claude Tooling Reference

Tools and skills available in this repo, and when to use them:

| Capability | Use for |
|---|---|
| `Plan` agent | Architecture and implementation planning, second opinions on design |
| `Explore` agent | Broad codebase research across many files or uncertain scope |
| `simplify` skill | Review changed code for reuse, quality, and efficiency |
| `/commit` | Generate a conventional-commit-compliant message from a staged diff |
| `/review-pr <n>` | Structured PR review: diff + simplify + CI status + conventions check |
| `/prepare-release` | Pre-release checklist: lint+build+test, classify commits, predict bumps |
| `mcp__github__*` | GitHub MCP tools for reading PRs, issues, releases; posting review comments (use sparingly) |

**Rules for AI agents working in this repo:**
- Never bypass the Stop hook (`~/.claude/stop-hook-git-check.sh`) — it exists to prevent leaving work uncommitted/unpushed.
- Never use `--no-verify`, `--no-gpg-sign`, or force-push to `master`.
- Never create a PR unless the user explicitly asked for one.
- Prefer editing existing files over creating new ones; avoid speculative abstractions.
- For any `.meta/` edits, follow the sync rule in the Task Management section.

## Task Management

**IMPORTANT: Always use `.meta/` as the source of truth for project tasks — never GitHub Issues directly.**

- The `.meta/` directory is the canonical store for all project management data (roadmaps, epics, stories, milestones).
- When looking for tasks, features, bugs, or any work items, read from `.meta/` files first.
- Entity types live at:
  - `.meta/roadmap/` — roadmap and milestones
  - `.meta/epics/` — epics and their nested stories
  - `.meta/stories/` — orphan stories (not linked to an epic)
- Each entity is a Markdown file with YAML frontmatter containing fields like `type`, `id`, `title`, `status`, `priority`, `epic_ref`, `labels`, and `github` sync metadata.
- To find tasks without an epic, look for stories in `.meta/stories/` (top-level) or stories where `epic_ref: null`.
- To find tasks without a milestone, look for epics/stories where there is no `milestone_ref` or the entity is not nested under a milestone-linked epic.
- GitHub Issues are a **sync target**, not the primary data source. The `.meta/` tree and GitHub stay in sync via `gitpm import`/`push`/`pull`/`sync` commands.

**IMPORTANT: After any ticketing or roadmap changes (creating/moving/updating stories, epics, or milestones in `.meta/`), you MUST run sync to push changes to GitHub:**
```bash
bun run build && node packages/cli/dist/index.js push --token "$GITHUB_TOKEN" --yes
```
This ensures `.meta/` and GitHub Issues stay in sync. Never skip this step after modifying `.meta/` files.

## Interactive Confirmations

When asking the user a yes/no or small multiple-choice question — phrases like "Want me to…?", "Should I…?", "Shall I proceed with…?", "Do you want X or Y?" — always use the **AskUserQuestion** tool instead of plain-text prose. This renders an interactive button dialog, which is faster and less ambiguous than the user typing "yes"/"no" in chat.

Guidelines:
- Use AskUserQuestion whenever 2–4 discrete options cover the answer. Put the recommended option first and append "(Recommended)" to its label.
- Keep option labels short (1–5 words); put trade-offs in the `description` field.
- Do NOT use AskUserQuestion for open-ended questions that need freeform input (e.g. "What should the commit message be?") — plain text is fine there.
- Do NOT use AskUserQuestion to announce progress or summarize work; it's for decisions only.
- A single tool call can bundle 1–4 related questions if they all need answers at the same decision point.
