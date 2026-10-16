---
title: CLI Reference
description: "Reference for the gitpm sync, planning, and reporting commands, with options and examples."
sidebar:
  order: 1
---

This page covers the commands for setting up and syncing your `.meta/` project tree, plus the planning and reporting commands (`context`, `sprint plan`, `audit`). Run `gitpm <command> --help` for the full option list of any command.

## Global Options

These options apply to all commands:

| Option | Description | Default |
|--------|-------------|---------|
| `--meta-dir <path>` | Path to the `.meta/` directory | `.meta` |
| `--token <token>` | Personal access token (GitHub or GitLab) | (auto-resolved) |
| `--version` | Print version | |
| `--help` | Print help | |

## Authentication

The token is resolved in priority order:

1. `--token` flag (highest priority)
2. `GITHUB_TOKEN` or `GITLAB_TOKEN` environment variable
3. GitHub CLI fallback (`gh auth token`)

If no token is found, the command exits with an error message.

For Linear, always pass the API key explicitly with `--token "$LINEAR_API_KEY"`. The CLI does not read `LINEAR_API_KEY` on its own, and without `--token` it would fall back to your GitHub token. See [Linear Configuration](/guides/sync/#linear-configuration).

---

## `gitpm init`

Initialize a new `.meta/` project structure with sample entities.

```
gitpm init [project-name]
```

**Arguments:**

| Argument | Description | Required |
|----------|-------------|----------|
| `project-name` | Name of the project | No (prompts interactively) |

**Examples:**

```bash
# Provide the name directly
gitpm init my-project

# Interactive — prompts for the name
gitpm init

# Use a custom .meta/ directory
gitpm init my-project --meta-dir ./project-meta
```

**Output:**

```
.meta/
    roadmap/
        roadmap.yaml
        milestones/
            v1.md
    epics/
        sample-epic/
            epic.md
            stories/
                sample-story.md
    stories/

Created 4 files in .meta/
```

---

## `gitpm validate`

Validate the `.meta/` project tree against schemas. Checks for parsing errors, broken references, circular dependencies, and status inconsistencies.

```
gitpm validate
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| `0` | Validation passed (may include warnings) |
| `1` | Validation failed with errors |

**Examples:**

```bash
# Validate the default .meta/ directory
gitpm validate

# Validate a custom directory
gitpm validate --meta-dir ./other-meta
```

**Output (success):**

```
.meta/ tree is valid (23 entities)
```

**Output (failure):**

```
  ✗ .meta/stories/broken.md: PARSE_ERROR: Invalid status value
  ✗ [abc123] ORPHANED_REF: epic_ref points to non-existent entity
  ⚠ [def456] STATUS_INCONSISTENCY: Epic is 'done' but has 'in_progress' stories

Validation failed with 2 error(s) and 1 warning(s)
```

---

## `gitpm import`

Import project data from GitHub or GitLab into `.meta/` files.

```
gitpm import [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--source <source>` | Source platform: `github` or `gitlab` | `github` |
| `--repo <owner/repo>` | GitHub repository (required for GitHub) | |
| `--project <value>` | GitHub Project number or GitLab project path | |
| `--token <token>` | Personal access token | (auto-resolved) |
| `--base-url <url>` | GitLab base URL | `https://gitlab.com` |
| `--link-strategy <strategy>` | Epic-story linkage strategy | `all` |

**Link strategies (GitHub):**

| Strategy | Description |
|----------|-------------|
| `body-refs` | Detect epic links from issue body references |
| `sub-issues` | Use GitHub sub-issue relationships |
| `milestone` | Group by shared milestone |
| `labels` | Use labels to identify epics vs stories |
| `all` | Combine all strategies (recommended) |

**Link strategies (GitLab):**

| Strategy | Description |
|----------|-------------|
| `body-refs` | Detect epic links from issue body references |
| `native-epics` | Use GitLab's native epic feature |
| `milestone` | Group by shared milestone |
| `labels` | Use labels to identify epics vs stories |
| `all` | Combine all strategies (recommended) |

**Examples:**

```bash
# Import from GitHub
gitpm import --repo myorg/myrepo

# Import from GitHub with a specific Project board
gitpm import --repo myorg/myrepo --project 5

# Import from GitLab
gitpm import --source gitlab --project mygroup/myproject

# Import from self-hosted GitLab
gitpm import --source gitlab --project mygroup/myproject \
  --base-url https://gitlab.mycompany.com --token glpat-...

# Use a specific link strategy
gitpm import --repo myorg/myrepo --link-strategy sub-issues
```

**Output:**

```
✔ Import complete.

Summary:
  Milestones: 3
  Epics:      8
  Stories:    42
  Files:      56

Imported 53 entities (56 files).
Run `gitpm validate` to verify the imported tree.
```

---

## `gitpm push`

Push local `.meta/` changes to GitHub or GitLab. The target platform is auto-detected from the sync configuration created during import.

```
gitpm push [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--token <token>` | Personal access token | (auto-resolved) |
| `--dry-run` | Preview changes without pushing | `false` |
| `--yes` | Skip confirmation prompt | `false` |

**Examples:**

```bash
# Push with confirmation prompt
gitpm push

# Preview changes without pushing
gitpm push --dry-run

# Push without confirmation
gitpm push --yes

# Push with an explicit token
gitpm push --token ghp_abc123
```

**Output:**

```
✔ Changes calculated.

Changes to push:
  New milestones: 1
  New issues:     5
  Updated milestones: 0
  Updated issues:     3
  Total changes:  9

? Push these changes to GitHub? (y/N)
✔ Push complete.
  Created 6, Updated 3
```

---

## `gitpm pull`

Pull changes from GitHub or GitLab into the local `.meta/` directory. The platform is auto-detected from sync configuration.

```
gitpm pull [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--token <token>` | Personal access token | (auto-resolved) |
| `--strategy <strategy>` | Conflict resolution strategy | `remote-wins` |

**Conflict resolution strategies:**

| Strategy | Description |
|----------|-------------|
| `local-wins` | Keep local version when conflicts occur |
| `remote-wins` | Use remote version when conflicts occur (default) |
| `ask` | Prompt interactively for each conflict |

**Examples:**

```bash
# Pull with default strategy (remote-wins)
gitpm pull

# Keep local changes in case of conflicts
gitpm pull --strategy local-wins

# Resolve conflicts interactively
gitpm pull --strategy ask
```

**Output:**

```
✔ Pull complete.

Pull Summary:
  Pulled: 7 changes
  Conflicts resolved: 2
  Skipped: 0

Pull complete.
```

---

## `gitpm sync`

Bidirectional sync between the local `.meta/` directory and GitHub or GitLab. Combines push and pull into a single operation with conflict resolution.

```
gitpm sync [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--token <token>` | Personal access token | (auto-resolved) |
| `--strategy <strategy>` | Conflict resolution strategy | `ask` |
| `--dry-run` | Preview changes without syncing | `false` |
| `--yes` | Skip confirmation prompt | `false` |

**Examples:**

```bash
# Interactive sync (prompts for confirmation and conflicts)
gitpm sync

# Auto-resolve conflicts with remote-wins
gitpm sync --strategy remote-wins --yes

# Preview what would change
gitpm sync --dry-run
```

**Output:**

```
? Run bidirectional sync with GitHub? (Y/n)
✔ Sync complete.

┌──────────────────────────────────────┐
│           Sync Complete              │
├──────────────────┬───────────────────┤
│ Pushed to GitHub │ 4                 │
│ Pulled to local  │ 7                 │
│ Conflicts        │ 2 resolved        │
│ Errors           │ 0                 │
└──────────────────┴───────────────────┘

Sync complete.
```

---

## `gitpm context`

Generate a short project-context summary from the `.meta/` tree, for AI agents. It covers the active milestone, the current sprint, active epics, and blocked items. You can print it, write it to a file, or splice it into `CLAUDE.md` so agents always start with current project state.

```
gitpm context [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--output <file>` | Write the context to a file instead of stdout | (stdout) |
| `--update` | Splice the context into `./CLAUDE.md` between `gitpm:context` markers | `false` |

**What each section contains:**

| Section | Source |
|---------|--------|
| Active Milestone | The first milestone that is not `done` or `cancelled`, ordered by `target_date` (milestones without a date sort last). Shows percent done, done/total stories, and the due date. |
| Current Sprint | The sprint whose `start_date`–`end_date` range contains today. Shows done/total stories and the date range. |
| Active Epics | Epics with status `in_progress` or `in_review`, each with done/total stories. |
| Blocked Items | Stories that are not started (not `in_progress`, `in_review`, `done`, or `cancelled`) and have no assignee, with their epic title. |

**`--update` behaviour:** the generated section is written between these markers in `CLAUDE.md` in the current working directory:

```markdown
<!-- gitpm:context:start -->
...generated context...
<!-- gitpm:context:end -->
```

If both markers exist, only the content between them is replaced and the rest of the file is kept. If they are missing, the block is appended to the end of the file. If `CLAUDE.md` does not exist, it is created.

**Examples:**

```bash
# Print context to stdout
gitpm context

# Write to a standalone file
gitpm context --output .meta/CONTEXT.md

# Refresh the generated block in CLAUDE.md
gitpm context --update
```

**Output:**

```markdown
## Project Context (generated by gitpm)

### Active Milestone
**v1.0 Launch** — 62% done (18/29 stories) — due 2026-12-01

### Current Sprint
**Sprint 14** — 3/8 stories done (2026-10-12 → 2026-10-26)

### Active Epics
- **Linear integration** — 4/6 done

### Blocked Items
- Add retry to webhook handler (Linear integration)
```

---

## `gitpm sprint plan`

Choose which stories belong to a sprint. By default it runs interactively: pick from a checklist of `todo` and `backlog` stories, review the points total against the sprint's `capacity`, then confirm before anything is written. With `--add` / `--remove` it runs non-interactively, which suits scripts and AI agents.

```
gitpm sprint plan <sprint> [options]
```

`<sprint>` is a sprint ID or a path to the sprint file (relative or absolute; any argument that contains `/` or ends in `.md` is treated as a path).

**Options:**

| Option | Description |
|--------|-------------|
| `--add <story-id...>` | Add one or more story IDs to the sprint (non-interactive) |
| `--remove <story-id...>` | Remove one or more story IDs from the sprint (non-interactive) |

**Behaviour:**

- **Interactive mode** lists only `todo` and `backlog` stories, and stories already in the sprint start checked. Stories in the sprint with any other status (for example `in_progress` or `done`) are not listed and are always kept.
- **Points** are the sum of each selected story's `estimate`; stories without one count as 0. If the sprint has a `capacity`, a progress bar shows `points/capacity pts` and flags `over capacity` in red. Without a capacity, the total is shown as `N pts (no capacity set)`.
- **Non-interactive mode** fails with an error, and writes nothing, if any `--add` ID does not match a story. `--remove` IDs that are not in the sprint are ignored.
- The sprint file's `stories` list and `updated_at` are rewritten in place.

**Examples:**

```bash
# Pick stories interactively
gitpm sprint plan sprint-14

# Plan by file path
gitpm sprint plan .meta/sprints/sprint-14.md

# Non-interactive: add two stories, drop one
gitpm sprint plan sprint-14 --add story-abc story-def --remove story-xyz
```

**Output:**

```
✔ Updated sprint "Sprint 14" (8 stories)
  ████████████░░░░ 21/28 pts
```

---

## `gitpm audit`

Detect project hygiene issues in the `.meta/` tree: stale stories, orphans, likely duplicates, empty bodies, and zombie epics.

```
gitpm audit [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--stale-days <days>` | Days without an update before a `todo` story is considered stale | `90` |
| `--json` | Output the full report as JSON | `false` |
| `--markdown` | Output a Markdown report with age-tiered stale sections (for CI artifacts) | `false` |

If both `--markdown` and `--json` are passed, `--markdown` wins.

**Markdown report:** `--markdown` prints a `# Project Audit` document with one section per check (Stale, Orphans, Duplicates, Empty bodies, Zombie epics). Each section is a table of ID, title, file path, and reason, and empty sections read `None.`. The Stale section is split into age tiers based on days since `updated_at`:

| Tier | Days since last update |
|------|------------------------|
| `< 30 days` | 0–29 (only when `--stale-days` is below 30) |
| `30-59 days` | 30–59 |
| `60-89 days` | 60–89 |
| `90+ days` | 90 and above |
| `Unknown age` | No usable `updated_at` |

Tiers with no items are left out. Duplicates are listed as pairs with a similarity percentage.

**Examples:**

```bash
# Human-readable report
gitpm audit

# Flag todos untouched for 30+ days, as Markdown, for a CI artifact
gitpm audit --stale-days 30 --markdown > audit-report.md

# Machine-readable output
gitpm audit --json
```

In GitHub Actions, you can publish the report to the job summary:

```yaml
- run: npx -y @gitpm/cli audit --markdown >> "$GITHUB_STEP_SUMMARY"
```
