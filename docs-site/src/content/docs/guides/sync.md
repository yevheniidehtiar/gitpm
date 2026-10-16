---
title: Sync Configuration
description: "Bidirectional sync between the .meta/ tree and remote issue trackers: setup, configuration, and daily workflows."
sidebar:
  order: 1
---

GitPM provides bidirectional sync between your `.meta/` file tree and remote issue trackers (GitHub, GitLab, Jira, Linear). This guide covers setup, configuration, and day-to-day sync workflows.

## Getting Started

### 1. Set up authentication

Set your access token as an environment variable:

```bash
# GitHub
export GITHUB_TOKEN="ghp_..."

# GitLab
export GITLAB_TOKEN="glpat-..."

# Jira
export JIRA_TOKEN="your-api-token"

# Linear (pass explicitly with --token "$LINEAR_API_KEY")
export LINEAR_API_KEY="lin_api_..."
```

Alternatively, pass the token directly via the `--token` flag on any command.

For GitHub, the token can also be resolved from the GitHub CLI (`gh auth token`) if installed and authenticated.

### 2. Import your project

```bash
# From GitHub
gitpm import --repo owner/repo

# From GitHub with a Project board
gitpm import --repo owner/repo --project 5

# From GitLab
gitpm import --source gitlab --project namespace/project

# From self-hosted GitLab
gitpm import --source gitlab --project namespace/project \
  --base-url https://gitlab.mycompany.com
```

This creates the `.meta/` directory with all imported entities and generates the sync configuration files.

### 3. Validate the import

```bash
gitpm validate
```

### 4. Start syncing

```bash
# Push local changes to remote
gitpm push

# Pull remote changes
gitpm pull

# Full bidirectional sync
gitpm sync
```

---

## Configuration Files

After import, sync configuration is stored in `.meta/sync/`. These files should be committed to your repository so all team members share the same sync settings.

### GitHub Configuration

**File:** `.meta/sync/github-config.yaml`

```yaml
repo: owner/repo                     # Required: GitHub repository
project_number: 5                    # Optional: GitHub Project (v2) number
status_mapping:                      # Maps GitHub Project status to GitPM status
  Todo: todo
  In Progress: in_progress
  In Review: in_review
  Done: done
  Backlog: backlog
label_mapping:
  epic_labels:                       # Issues with these labels become Epics
    - epic
auto_sync: false                     # Reserved for future use
```

### GitLab Configuration

**File:** `.meta/sync/gitlab-config.yaml`

```yaml
project: namespace/project           # Required: GitLab project path
project_id: 123                      # Required: GitLab project numeric ID
base_url: https://gitlab.com         # GitLab instance URL
status_mapping:
  opened: todo
  closed: done
label_mapping:
  epic_labels:
    - epic
```

### Jira Configuration

**File:** `.meta/sync/jira-config.yaml`

```yaml
site: mycompany.atlassian.net        # Jira Cloud site
project_key: PROJ                    # Jira project key
workflow_mapping:                    # Maps Jira workflow statuses to GitPM status
  To Do: todo
  In Progress: in_progress
  In Review: in_review
  Done: done
  Backlog: backlog
```

### Linear Configuration

The Linear adapter ships as a separate package and talks to the Linear GraphQL API (`https://api.linear.app/graphql`):

```bash
bun add @gitpm/sync-linear
```

**File:** `.meta/sync/linear-config.yaml`

```yaml
team_id: 5f1c...                     # Required: Linear team ID (UUID)
status_mapping:                      # Maps Linear workflow state *type* to GitPM status
  triage: backlog
  backlog: backlog
  unstarted: todo
  started: in_progress
  completed: done
  canceled: cancelled
auto_sync: false                     # Reserved for future use
```

The keys of `status_mapping` are Linear workflow state **types**, not the state names shown in your team's board, so custom states such as "In QA" map through their type (`started`). Any type missing from the mapping defaults to `todo`.

**Setup:**

1. Create a personal API key in Linear under **Settings → Security & access → Personal API keys**, and export it as `LINEAR_API_KEY`.
2. Find your team ID. Open the command menu in Linear (`Cmd/Ctrl+K`) and run **Copy model UUID** on the team, or query `{ teams { nodes { id name } } }` in the Linear API explorer.
3. Create `.meta/sync/linear-config.yaml` with that `team_id`, using the example above.
4. Sync, passing the key explicitly and selecting the adapter:

```bash
gitpm push --adapter linear --token "$LINEAR_API_KEY" --dry-run
gitpm pull --adapter linear --token "$LINEAR_API_KEY"
gitpm sync --adapter linear --token "$LINEAR_API_KEY"
```

Always pass `--token` for Linear. Without it, the CLI falls back to `GITHUB_TOKEN` or `gh auth token` and sends that to Linear. Pass `--adapter linear` whenever another adapter's config is also in `.meta/sync/`, because auto-detection picks the first adapter whose config it finds.

**How Linear maps to GitPM:**

| Linear | GitPM |
|--------|-------|
| Cycle | Milestone (`done` once the cycle is completed, otherwise `in_progress`) |
| Issue with sub-issues | Epic |
| Leaf issue | Story, linked to its parent epic and to the milestone for its cycle |
| Priority 1 / 2 / 3 / 4 / 0 (Urgent / High / Medium / Low / None) | `critical` / `high` / `medium` / `low` / `medium` |

Synced entities carry a `linear:` block in their frontmatter (`issue_id`, `identifier`, `team_id`, `cycle_id`, `last_sync_hash`, `synced_at`), and the sync state is kept in `.meta/sync/linear-state.json`.

:::note
The adapter can import a Linear team into `.meta/`, but `gitpm import` has no option for the team ID yet, so importing from the CLI currently fails with `Linear team ID is required`. Until it does, create `linear-config.yaml` by hand as shown above and use `push`, `pull`, and `sync`.
:::

---

## Status Mapping

The `status_mapping` maps the remote platform's status values to GitPM's standard status enum (`backlog`, `todo`, `in_progress`, `in_review`, `done`, `cancelled`).

**Default GitHub mapping:**

| GitHub Project Status | GitPM Status |
|----------------------|--------------|
| Todo | `todo` |
| In Progress | `in_progress` |
| In Review | `in_review` |
| Done | `done` |
| Backlog | `backlog` |

You can customize this mapping to match your project's workflow. Any GitHub status not in the mapping defaults to `todo`.

---

## Priority Mapping

During import, GitPM infers priority from issue labels using the following defaults:

| Labels | GitPM Priority |
|--------|---------------|
| `priority:critical`, `P0`, `critical`, `urgent` | `critical` |
| `priority:high`, `P1` | `high` |
| `priority:medium`, `P2` | `medium` |
| `priority:low`, `P3` | `low` |

Issues without a matching priority label default to `medium`.

---

## Epic Detection

By default, an issue is classified as an **Epic** (rather than a Story) if it has any of the labels listed in `label_mapping.epic_labels` (default: `["epic"]`).

You can customize this by editing the config file:

```yaml
label_mapping:
  epic_labels:
    - epic
    - theme
    - initiative
```

---

## Link Strategies

When importing, GitPM needs to determine which stories belong to which epics. The `--link-strategy` option controls how this linkage is detected:

| Strategy | Description |
|----------|-------------|
| `body-refs` | Parses issue bodies for references to other issues (e.g., `#123`) |
| `sub-issues` | Uses GitHub's sub-issue relationships |
| `native-epics` | Uses GitLab's native epic feature (GitLab only) |
| `milestone` | Groups stories under epics that share the same milestone |
| `labels` | Uses label matching to determine epic membership |
| `all` | Tries all available strategies in combination (default, recommended) |

```bash
# Use only sub-issue linking
gitpm import --repo owner/repo --link-strategy sub-issues

# Use all strategies (default)
gitpm import --repo owner/repo --link-strategy all
```

---

## Sync Workflows

### Daily workflow

```bash
# 1. Pull latest remote changes
gitpm pull

# 2. Edit .meta/ files locally (or via the web UI)
#    - Update status, priority, assignee
#    - Add new stories
#    - Edit descriptions

# 3. Push your changes
gitpm push

# Or do both at once
gitpm sync
```

### Conflict Resolution

Conflicts occur when the same entity has been modified both locally and remotely since the last sync. GitPM supports three resolution strategies:

| Strategy | Behavior |
|----------|----------|
| `local-wins` | Local changes always take precedence |
| `remote-wins` | Remote changes always take precedence |
| `ask` | Prompt interactively for each conflict |

```bash
# Accept all remote changes
gitpm pull --strategy remote-wins

# Resolve conflicts interactively
gitpm sync --strategy ask

# Keep local changes
gitpm sync --strategy local-wins
```

### Dry Run

Preview what would change before committing to a sync:

```bash
gitpm push --dry-run
gitpm sync --dry-run
```

---

## Sync State

The sync state file (`.meta/sync/github-state.json` or equivalent) tracks the last-synced content hash for every entity. This enables the sync engine to detect which side has changed since the last sync.

```json
{
  "repo": "owner/repo",
  "last_sync": "2026-03-15T10:00:00Z",
  "entities": {
    "a1b2c3d4e5f6": {
      "github_issue_number": 42,
      "local_hash": "sha256:abc...",
      "remote_hash": "sha256:def...",
      "synced_at": "2026-03-15T10:00:00Z"
    }
  }
}
```

**Important:** This file is auto-managed by the sync engine. Commit it to Git (so all team members share sync state), but never edit it manually.

### Resetting sync state

If the sync state becomes corrupted or out of date, you can re-import to regenerate it:

```bash
rm -rf .meta/sync/
gitpm import --repo owner/repo
```

---

## Content Hashing

The sync engine uses SHA-256 content hashes for change detection. Only semantically meaningful fields are hashed (not metadata like `synced_at`):

- `title`
- `status`
- `priority`
- `assignee`
- `labels`
- `body` (Markdown content)

Keys are sorted alphabetically and whitespace is normalized, ensuring stable hashes regardless of YAML serialization order or minor formatting differences.

---

## Environment Variables

| Variable | Platform | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | GitHub | Personal access token with `repo` scope |
| `GITLAB_TOKEN` | GitLab | Personal access token with `api` scope |
| `JIRA_TOKEN` | Jira | API token from [Atlassian account settings](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `LINEAR_API_KEY` | Linear | Personal API key from Linear **Settings → Security & access**. Not read automatically: pass it with `--token "$LINEAR_API_KEY"` |
