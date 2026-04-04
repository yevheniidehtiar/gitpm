# GitPM — Phase 5 Demo: @gitpm/cli — Sync Commands

> **Status**: Complete | **Tests**: 129 passed | **Build**: Passing | **Files**: 7 new/modified source files

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Auth Utility](#auth-utility)
- [Import Command](#import-command)
- [Push Command](#push-command)
- [Pull Command](#pull-command)
- [Sync Command](#sync-command)
- [Interactive Conflict Resolution](#interactive-conflict-resolution)
- [CLI Help Output](#cli-help-output)
- [Full Test Results](#full-test-results)
- [Build Output](#build-output)
- [How to Use](#how-to-use)
- [What's Next](#whats-next)

---

## Overview

Phase 5 connects the sync engine (Phases 3-4) to the CLI, giving users four powerful commands for GitHub synchronization: `import`, `push`, `pull`, and `sync`. It also adds a multi-source auth utility and an interactive conflict resolution UI.

```
User Terminal
    │
    ▼
┌─────────────────────────────────────────────┐
│              gitpm CLI                       │
│  ┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ import │ │ push │ │ pull │ │ sync │    │
│  └───┬────┘ └──┬───┘ └──┬───┘ └──┬───┘    │
│      │         │        │        │          │
│  ┌───▼─────────▼────────▼────────▼───┐     │
│  │        Auth Utility               │     │
│  │  --token → $GITHUB_TOKEN → gh CLI │     │
│  └───────────────┬───────────────────┘     │
│                  │                          │
│  ┌───────────────▼───────────────────┐     │
│  │     Conflict Resolution UI        │     │
│  │  (interactive prompts for --ask)  │     │
│  └───────────────────────────────────┘     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│     @gitpm/sync-github               │
│  importFromGitHub / exportToGitHub   │
│  syncWithGitHub                      │
└──────────────────────────────────────┘
```

---

## Architecture

Phase 5 adds 7 files to the CLI package:

```
packages/cli/src/
├── index.ts                    # Updated: registers all 6 commands
├── commands/
│   ├── init.ts                 # Phase 2
│   ├── validate.ts             # Phase 2
│   ├── import.ts               # NEW: import from GitHub
│   ├── push.ts                 # NEW: push local → GitHub
│   ├── pull.ts                 # NEW: pull GitHub → local
│   └── sync.ts                 # NEW: bidirectional sync
└── utils/
    ├── config.ts               # Phase 2
    ├── output.ts               # Phase 2
    ├── auth.ts                 # NEW: token resolution chain
    └── conflict-ui.ts          # NEW: interactive conflict prompts
```

---

## Auth Utility

The auth utility resolves a GitHub token from three sources in priority order, providing a seamless developer experience.

### Implementation

```typescript
// packages/cli/src/utils/auth.ts
import { execSync } from 'node:child_process';

export async function resolveToken(cliToken?: string): Promise<string> {
  // 1. Explicit --token flag
  if (cliToken) return cliToken;

  // 2. GITHUB_TOKEN environment variable
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) return envToken;

  // 3. GitHub CLI fallback
  try {
    const ghToken = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (ghToken) return ghToken;
  } catch {
    // gh CLI not installed or not authenticated
  }

  throw new Error(
    "No GitHub token found. Provide via --token flag, " +
    "GITHUB_TOKEN env var, or install GitHub CLI (gh) " +
    "and run 'gh auth login'."
  );
}
```

### Token Resolution Chain

```
┌──────────┐     ┌────────────────┐     ┌──────────────┐
│ --token  │────►│ GITHUB_TOKEN   │────►│ gh auth token│
│  flag    │     │  env var       │     │  subprocess  │
└──────────┘     └────────────────┘     └──────────────┘
  Priority 1        Priority 2            Priority 3
```

---

## Import Command

`gitpm import` fetches milestones, issues, and project data from GitHub and creates the local `.meta/` tree.

### Usage

```bash
gitpm import --repo owner/repo [--project <number>] [--token <token>]
```

### Implementation Highlights

```typescript
// packages/cli/src/commands/import.ts
export const importCommand = new Command('import')
  .description('Import project data from GitHub into .meta/')
  .requiredOption('--repo <owner/repo>', 'GitHub repository (owner/repo)')
  .option('--project <number>', 'GitHub Project number', Number.parseInt)
  .option('--token <token>', 'GitHub personal access token')
  .action(async (opts, cmd) => {
    const metaDir = resolveMetaDir(cmd.optsWithGlobals().metaDir);
    const token = await resolveToken(opts.token);

    const spinner = ora('Importing from GitHub...').start();
    const result = await importFromGitHub({ token, repo, metaDir, ... });

    spinner.succeed('Import complete.');
    // Prints summary table with entity counts
  });
```

### Sample Output

```
$ gitpm import --repo myorg/myproject --token ghp_xxx
⠋ Importing from GitHub...
✔ Import complete.

Summary:
  Milestones: 3
  Epics:      5
  Stories:    12
  Files:      24

✓ Imported 20 entities (24 files).
Run `gitpm validate` to verify the imported tree.
```

---

## Push Command

`gitpm push` exports local `.meta/` changes to GitHub, with dry-run preview and confirmation prompt.

### Usage

```bash
gitpm push [--token <token>] [--dry-run] [--yes]
```

### Implementation Highlights

```typescript
// packages/cli/src/commands/push.ts
export const pushCommand = new Command('push')
  .description('Push local .meta/ changes to GitHub')
  .option('--dry-run', 'Preview changes without pushing')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (opts, cmd) => {
    // 1. Dry run first to preview changes
    const preview = await exportToGitHub({ ..., dryRun: true });
    printPreview(preview.value);

    // 2. Confirm with user (unless --yes)
    if (!opts.yes) {
      const confirmed = await confirm({
        message: 'Push these changes to GitHub?',
      });
      if (!confirmed) return;
    }

    // 3. Execute the push
    const result = await exportToGitHub({ ..., dryRun: false });
  });
```

### Sample Output

```
$ gitpm push --dry-run
⠋ Calculating changes...
✔ Dry run complete.

Changes to push:
  New milestones: 1
  New issues:     3
  Updated milestones: 0
  Updated issues:     2
  Total changes:  6

$ gitpm push --yes
✔ Push complete.
  Created 4, Updated 2, Unchanged 14
```

---

## Pull Command

`gitpm pull` fetches remote changes from GitHub and applies them to local `.meta/` files.

### Usage

```bash
gitpm pull [--token <token>] [--strategy <local-wins|remote-wins|ask>]
```

### Implementation Highlights

```typescript
// packages/cli/src/commands/pull.ts
export const pullCommand = new Command('pull')
  .description('Pull changes from GitHub into local .meta/')
  .option('--strategy <strategy>', '...', 'remote-wins')
  .action(async (opts, cmd) => {
    const result = await syncWithGitHub({
      token, repo, metaDir,
      strategy: opts.strategy,
    });

    // Interactive conflict resolution when --strategy=ask
    if (strategy === 'ask' && result.value.conflicts.length > 0) {
      await promptConflictResolution(result.value.conflicts);
    }
  });
```

### Sample Output

```
$ gitpm pull --strategy remote-wins
⠋ Pulling from GitHub...
✔ Pull complete.

Pull Summary:
  Pulled: 5 changes
  Conflicts resolved: 0
  Skipped: 0

✓ Pull complete.
```

---

## Sync Command

`gitpm sync` performs full bidirectional synchronization between local `.meta/` and GitHub.

### Usage

```bash
gitpm sync [--token <token>] [--strategy <local-wins|remote-wins|ask>] [--dry-run] [--yes]
```

### Implementation Highlights

```typescript
// packages/cli/src/commands/sync.ts
function printSyncSummary(result: SyncResult): void {
  console.log(chalk.bold('┌──────────────────────────────────────┐'));
  console.log(chalk.bold('│           Sync Complete              │'));
  console.log(chalk.bold('├──────────────────┬───────────────────┤'));
  console.log(`│ Pushed to GitHub │ ${pushedTotal}              │`);
  console.log(`│ Pulled to local  │ ${pulledTotal}              │`);
  console.log(`│ Conflicts        │ ${resolved} resolved        │`);
  console.log(`│ Errors           │ ${skipped}                  │`);
  console.log(chalk.bold('└──────────────────┴───────────────────┘'));
}
```

### Sample Output

```
$ gitpm sync --dry-run
⠋ Calculating sync changes...
✔ Dry run complete.

┌──────────────────────────────────────┐
│           Sync Complete              │
├──────────────────┬───────────────────┤
│ Pushed to GitHub │ 3                 │
│ Pulled to local  │ 2                 │
│ Conflicts        │ 0 resolved        │
│ Errors           │ 0                 │
└──────────────────┴───────────────────┘

✓ Sync complete.
```

---

## Interactive Conflict Resolution

When `--strategy=ask` is used with `pull` or `sync`, conflicts are presented interactively.

### Implementation

```typescript
// packages/cli/src/utils/conflict-ui.ts
export async function promptConflictResolution(
  conflicts: FieldConflict[],
): Promise<Resolution[]> {
  for (const conflict of conflicts) {
    console.log(chalk.yellow('━━━ CONFLICT ━━━━━━━━━━━━━━━'));
    console.log(`Entity: "${conflict.entityTitle}" (${conflict.entityId})`);
    console.log(`Field:  ${conflict.field}`);
    console.log(`  Local:  ${conflict.localValue}`);
    console.log(`  Remote: ${conflict.remoteValue}`);

    const pick = await select({
      message: 'How do you want to resolve this conflict?',
      choices: [
        { name: '[l] Keep local',  value: 'local' },
        { name: '[r] Keep remote', value: 'remote' },
        { name: '[s] Skip',        value: 'skip' },
      ],
    });
  }
  return resolutions;
}
```

### Sample Conflict UI

```
━━━ CONFLICT ━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entity: "Implement forecasting API" (st_abc123)
Type:   story
Field:  _all

  Local:  sha256:a1b2c3...
  Remote: sha256:d4e5f6...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
? How do you want to resolve this conflict?
❯ [l] Keep local
  [r] Keep remote
  [s] Skip (leave unresolved)
```

---

## CLI Help Output

### Main Help

```
$ gitpm --help
Usage: gitpm [options] [command]

Git-native project management

Options:
  -V, --version        output the version number
  --meta-dir <path>    Path to .meta directory (default: ".meta")
  --token <token>      GitHub personal access token
  -h, --help           display help for command

Commands:
  init [project-name]  Initialize a new .meta/ project structure
  validate             Validate the .meta/ project tree
  import [options]     Import project data from GitHub into .meta/
  push [options]       Push local .meta/ changes to GitHub
  pull [options]       Pull changes from GitHub into local .meta/
  sync [options]       Bidirectional sync between local .meta/ and GitHub
  help [command]       display help for command
```

### Import Help

```
$ gitpm import --help
Usage: gitpm import [options]

Import project data from GitHub into .meta/

Options:
  --repo <owner/repo>  GitHub repository (owner/repo)
  --project <number>   GitHub Project number
  --token <token>      GitHub personal access token
  -h, --help           display help for command
```

### Push Help

```
$ gitpm push --help
Usage: gitpm push [options]

Push local .meta/ changes to GitHub

Options:
  --token <token>  GitHub personal access token
  --dry-run        Preview changes without pushing
  --yes            Skip confirmation prompt
  -h, --help       display help for command
```

### Pull Help

```
$ gitpm pull --help
Usage: gitpm pull [options]

Pull changes from GitHub into local .meta/

Options:
  --token <token>        GitHub personal access token
  --strategy <strategy>  Conflict resolution strategy (local-wins, remote-wins,
                         ask) (default: "remote-wins")
  -h, --help             display help for command
```

### Sync Help

```
$ gitpm sync --help
Usage: gitpm sync [options]

Bidirectional sync between local .meta/ and GitHub

Options:
  --token <token>        GitHub personal access token
  --strategy <strategy>  Conflict resolution strategy (local-wins, remote-wins,
                         ask) (default: "ask")
  --dry-run              Preview changes without syncing
  --yes                  Skip confirmation prompt
  -h, --help             display help for command
```

---

## Full Test Results

All 129 tests pass across the full codebase:

```
$ bun run test
$ vitest run

 RUN  v2.1.9 /home/user/gitpm

 ✓ packages/sync-github/src/__tests__/diff.test.ts (14 tests) 20ms
 ✓ packages/sync-github/src/__tests__/state.test.ts (14 tests) 38ms
 ✓ packages/sync-github/src/__tests__/mapper.test.ts (20 tests) 12ms
 ✓ packages/core/src/schemas/__tests__/schemas.test.ts (20 tests) 30ms
 ✓ packages/sync-github/src/__tests__/import.test.ts (8 tests) 167ms
 ✓ packages/sync-github/src/__tests__/sync.test.ts (7 tests) 220ms
 ✓ packages/sync-github/src/__tests__/export.test.ts (4 tests) 110ms
 ✓ packages/core/src/validator/validator.test.ts (6 tests) 33ms
 ✓ packages/core/src/resolver/resolver.test.ts (11 tests) 77ms
 ✓ packages/sync-github/src/__tests__/conflict.test.ts (7 tests) 5ms
 ✓ packages/core/src/parser/parser.test.ts (10 tests) 37ms
 ✓ packages/core/src/writer/writer.test.ts (7 tests) 66ms
 ✓ packages/core/src/index.test.ts (1 test) 2ms

 Test Files  13 passed (13)
      Tests  129 passed (129)
   Start at  11:55:00
   Duration  2.40s
```

---

## Build Output

```
$ bun run build

@gitpm/core build: ESM dist/index.js 20.20 KB
@gitpm/core build: ESM ⚡️ Build success in 43ms
@gitpm/core build: DTS dist/index.d.ts 25.40 KB

@gitpm/sync-github build: ESM dist/index.js 44.82 KB
@gitpm/sync-github build: ESM ⚡️ Build success in 29ms
@gitpm/sync-github build: DTS dist/index.d.ts 9.52 KB

@gitpm/ui build: dist/index.html   0.32 kB
@gitpm/ui build: dist/assets/index  143.73 kB
@gitpm/ui build: ✓ built in 1.12s

gitpm build: ESM dist/index.js 18.42 KB
gitpm build: ESM ⚡️ Build success in 24ms
```

---

## How to Use

### End-to-End Workflow

```bash
# 1. Import an existing GitHub project
gitpm import --repo myorg/myproject --token ghp_xxx

# 2. Validate the imported tree
gitpm validate

# 3. Edit .meta/ files locally (change status, titles, etc.)
# ... make changes to .meta/stories/implement-auth.md

# 4. Preview what would be pushed
gitpm push --dry-run

# 5. Push changes to GitHub
gitpm push --yes

# 6. Pull remote changes made by teammates
gitpm pull --strategy remote-wins

# 7. Full bidirectional sync with interactive conflict resolution
gitpm sync --strategy ask
```

### Auth Setup

```bash
# Option A: Use GitHub CLI (recommended)
gh auth login

# Option B: Set environment variable
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Option C: Pass directly
gitpm import --repo owner/repo --token ghp_xxxxxxxxxxxx
```

---

## What's Next

**Phase 6: @gitpm/ui — Local Web Interface**

- React + Tailwind web application for visual project management
- TanStack Router for navigation, TanStack Query for data fetching
- Roadmap, Epic, and Story views with inline editing
- Integration with the CLI and sync engine for real-time updates
