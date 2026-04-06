# CLI Reference

GitPM provides six commands for managing your `.meta/` project tree and syncing with remote platforms.

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
