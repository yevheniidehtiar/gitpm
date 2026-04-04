# Phase 0: Scaffold Monorepo

Read `CLAUDE.md` for project context and `docs/IMPLEMENTATION_PLAN.md` Phase 0 for detailed tasks.

## Execute

1. Initialize the Bun workspace monorepo at the project root.
2. Create root `package.json` with `workspaces: ["packages/*"]` and scripts: `build`, `test`, `lint`, `dev:ui`.
3. Create base `tsconfig.json` — strict mode, ESM, `moduleResolution: "bundler"`, `target: "ES2022"`, `declaration: true`, paths aliases for workspace packages.
4. Create `biome.json` — indent 2 spaces, single quotes, trailing commas, organize imports, `noExplicitAny: error`, `useConst: error`.
5. Create `vitest.config.ts` at root with workspace-aware configuration.
6. Create all four packages:
   - `packages/core/package.json` — name `@gitpm/core`, no external deps yet (add `yaml`, `gray-matter`, `zod`, `nanoid` as dependencies)
   - `packages/sync-github/package.json` — name `@gitpm/sync-github`, depends on `@gitpm/core: "workspace:*"`, `@octokit/rest`
   - `packages/cli/package.json` — name `gitpm`, bin `gitpm → ./dist/index.js`, depends on `@gitpm/core: "workspace:*"`, `@gitpm/sync-github: "workspace:*"`, `commander`, `chalk`, `ora`, `@inquirer/prompts`
   - `packages/ui/package.json` — name `@gitpm/ui`, depends on `@gitpm/core: "workspace:*"`, `react`, `react-dom`, `tailwindcss`, `@tanstack/react-router`, `@tanstack/react-query`, `hono`, `@hono/node-server`
7. Each package gets a `tsconfig.json` extending the root one, with its own `outDir` and `rootDir`.
8. Each package gets `src/index.ts` with a placeholder export.
9. Configure `tsup` for `core`, `sync-github`, and `cli` (ESM output, dts generation). Configure Vite for `ui`.
10. Create `.gitignore`: node_modules, dist, .env, coverage, .DS_Store.
11. Run `bun install` and verify all workspace links resolve.
12. Run `bun run build`, `bun run test`, `bun run lint` — all must pass with zero errors.

## Verify

After completion, confirm:
- `bun run build` succeeds for all packages
- `bun run test` exits 0
- `bun run lint` passes
- Workspace package cross-references resolve correctly (sync-github can import from core, cli can import from both)
