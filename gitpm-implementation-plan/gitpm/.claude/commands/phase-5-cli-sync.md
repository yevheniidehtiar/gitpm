# Phase 5: @gitpm/cli — Sync Commands

Read `CLAUDE.md` for project context and `docs/IMPLEMENTATION_PLAN.md` Phase 5 for detailed tasks.

Depends on: Phase 2 (CLI framework), Phase 3 & 4 (sync-github package).

## Execute in order

### Step 1: Auth Utility

Create `packages/cli/src/utils/auth.ts`:

`resolveToken(cliToken?: string): Promise<string>`

Try in order:
1. `cliToken` argument (from `--token` flag) — return immediately if present.
2. `process.env.GITHUB_TOKEN` — return if set.
3. Run `gh auth token` as a subprocess (`child_process.execSync`). If `gh` CLI is installed and authenticated, it returns a token. Catch errors silently.
4. If none found, throw with a clear message: "No GitHub token found. Provide via --token flag, GITHUB_TOKEN env var, or install GitHub CLI (gh) and run 'gh auth login'."

### Step 2: `gitpm import` command

Create `packages/cli/src/commands/import.ts`:

```
gitpm import --repo <owner/repo> [--project <number>] [--token <token>] [--meta-dir <path>]
```

Implementation:
1. Resolve token via auth utility.
2. Validate repo format (must be "owner/repo").
3. Show spinner: "Importing from GitHub...".
4. Call `importFromGitHub({ token, repo, projectNumber, metaDir })`.
5. On success: print summary table with counts (milestones, epics, stories, total files). Print the generated file tree. Suggest: "Run `gitpm validate` to verify the imported tree."
6. On error: print error in red, exit 1.

### Step 3: `gitpm push` command

Create `packages/cli/src/commands/push.ts`:

```
gitpm push [--token <token>] [--dry-run] [--yes] [--meta-dir <path>]
```

Implementation:
1. Resolve token.
2. If `--dry-run`: call `exportToGitHub({ ..., dryRun: true })`. Print what would be pushed (new entities to create, changed entities to update) in a formatted table. Exit 0.
3. Otherwise: call `exportToGitHub()` with dryRun first to get the preview.
4. Print the preview table.
5. Unless `--yes` is set, prompt: "Push these changes to GitHub? (y/N)".
6. If confirmed, call `exportToGitHub({ ..., dryRun: false })`.
7. Print results: "Created X, Updated Y, Unchanged Z".

### Step 4: `gitpm pull` command

Create `packages/cli/src/commands/pull.ts`:

```
gitpm pull [--token <token>] [--strategy <local-wins|remote-wins|ask>] [--meta-dir <path>]
```

Implementation:
1. Resolve token.
2. Call `syncWithGitHub({ ..., strategy })` but only apply remote changes (skip pushing local changes). This is a partial sync — fetch remote state, diff, apply remote-only and resolve conflicts. To implement this cleanly, add a `direction: 'pull' | 'push' | 'both'` option to `SyncOptions`.
3. If strategy is `ask` and conflicts exist, present each conflict interactively (Step 6).
4. Print summary: "Pulled X changes, Y conflicts resolved, Z skipped".

### Step 5: `gitpm sync` command

Create `packages/cli/src/commands/sync.ts`:

```
gitpm sync [--token <token>] [--strategy <local-wins|remote-wins|ask>] [--dry-run] [--yes] [--meta-dir <path>]
```

Implementation:
1. Resolve token.
2. If `--dry-run`: run sync in dry-run mode. Print a two-column summary showing outgoing changes (local → GitHub) and incoming changes (GitHub → local). Show conflicts. Exit 0.
3. Otherwise: run sync with the specified strategy.
4. If strategy is `ask`, handle conflicts interactively.
5. Print summary table:
   ```
   ┌──────────────────────────────────────┐
   │           Sync Complete              │
   ├──────────────────┬───────────────────┤
   │ Pushed to GitHub │ 3 changes         │
   │ Pulled to local  │ 2 changes         │
   │ Conflicts        │ 1 resolved        │
   │ Errors           │ 0                 │
   └──────────────────┴───────────────────┘
   ```

### Step 6: Interactive Conflict Resolution

Create `packages/cli/src/utils/conflict-ui.ts`:

`promptConflictResolution(conflicts: FieldConflict[]): Promise<Resolution[]>`

For each conflict, display:
```
━━━ CONFLICT ━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entity: "Implement forecasting API" (st_abc123)
Field:  status

  Local:  in_review
  Remote: done

  [l] Keep local
  [r] Keep remote
  [s] Skip (leave unresolved)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Use `@inquirer/prompts` select prompt for each conflict. Collect and return all resolutions.

### Step 7: Register All Commands

Update `packages/cli/src/index.ts` to register all commands: init, validate, import, push, pull, sync. Add `--token` as a global option (available to all commands).

## Verify

- `gitpm import --repo <real-repo> --token <token>` successfully imports from a real GitHub repo.
- `gitpm push --dry-run` shows an accurate preview without making API calls.
- `gitpm push` creates issues on GitHub and writes back IDs to local files.
- `gitpm pull` detects remote changes and applies them locally.
- `gitpm sync` handles bidirectional changes correctly.
- Interactive conflict resolution works when `--strategy=ask`.
- Auth fallback chain works: --token → GITHUB_TOKEN → gh CLI.
- All commands show `--help` with correct usage.
