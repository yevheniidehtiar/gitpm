# Sync Configuration Guide

GitPM provides bidirectional sync between your `.meta/` file tree and remote issue trackers (GitHub, GitLab, Jira). This guide covers setup, configuration, and day-to-day sync workflows.

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
