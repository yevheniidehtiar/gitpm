# Sync Configuration Guide

GitPM provides bidirectional sync between your `.meta/` file tree and remote issue trackers (GitHub, GitLab, Jira, Linear and Bitbucket Cloud). This guide covers setup, configuration, and day-to-day sync workflows.

## Getting Started

### 1. Set up authentication

Every command accepts `--token`. Without it, each adapter reads its own environment variable, and GitHub also falls back to the GitHub CLI (`gh auth token`):

```bash
export GITHUB_TOKEN="ghp_..."                                    # GitHub, or run `gh auth login` once
export GITLAB_TOKEN="glpat-..."                                  # GitLab
export JIRA_TOKEN="..." JIRA_EMAIL="you@example.com"             # Jira
export BITBUCKET_TOKEN="..." BITBUCKET_EMAIL="you@example.com"   # Bitbucket, see below
```

The Linear adapter reads `LINEAR_API_KEY`. An adapter never receives another adapter's token. Never commit tokens or write them into `.meta/sync/*.yaml`.

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

# From Bitbucket Cloud
gitpm import --source bitbucket --repo workspace/repo_slug
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

### Bitbucket Configuration

**File:** `.meta/sync/bitbucket-config.yaml`

```yaml
workspace: myteam                    # Required: Bitbucket workspace
repo_slug: myrepo                    # Required: repository slug
base_url: https://api.bitbucket.org/2.0
status_mapping: {}                   # Overrides merged over the defaults
priority_mapping: {}
kind_mapping: {}
epic_linkage: both                   # component, body-marker or both
auto_sync: false                     # Reserved for future use
```

See [Bitbucket Cloud](#bitbucket-cloud) for the defaults and every field.

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

## Bitbucket Cloud

The `@gitpm/sync-bitbucket` adapter syncs stories, epics and milestones with the issue tracker of one Bitbucket Cloud repository.

### Limitations

- **Bitbucket Cloud only.** Bitbucket Data Center and Server have no issue tracker of their own and hand issues off to Jira. Use the [Jira adapter](#jira-configuration) there.
- **The issue tracker must be enabled** in the repository settings.
- **Milestones and components are read-only over the API.** Bitbucket's REST 2.0 API can list them but not create them. Import reads them. `gitpm push` links local milestones to existing Bitbucket milestones by name and prints a warning for each one that does not exist. Create the missing milestones or components in the repository settings, then push again. `gitpm pull` and `gitpm sync` do not touch milestones.
- **No issue hierarchy and no labels.** Bitbucket has no epics, sub-issues or labels. gitpm records each story's epic itself (see [Epic linkage](#epic-linkage)) and maps the issue kind to a label (see [Bitbucket kind mapping](#bitbucket-kind-mapping)). Other labels stay local.

### Install

```bash
npm install -g @gitpm/cli @gitpm/sync-bitbucket
```

### Authentication

The adapter accepts two kinds of token. It picks one by whether an email is set:

| Token | Set | Sent as | Use when |
|---|---|---|---|
| Atlassian API token | `BITBUCKET_TOKEN` and `BITBUCKET_EMAIL` | HTTP Basic, `email:token` | Personal use |
| Workspace or repository access token | `BITBUCKET_TOKEN` only | `Bearer` token | CI and bots |

```bash
# Personal: an Atlassian API token plus the email of your Atlassian account
export BITBUCKET_TOKEN="..."
export BITBUCKET_EMAIL="you@example.com"

# CI: a workspace or repository access token, without an email
export BITBUCKET_TOKEN="..."
```

`--token` overrides `BITBUCKET_TOKEN`. The email is read only from `BITBUCKET_EMAIL`, so leave it unset when you use an access token.

The token needs read access to the repository and read and write access to its issues. For an Atlassian API token with scopes, grant `read:repository:bitbucket`, `read:issue:bitbucket` and `write:issue:bitbucket`. For an access token, grant **Repositories: Read**, **Issues: Read** and **Issues: Write**.

App passwords are deprecated by Atlassian and are not supported.

### Import

```bash
gitpm import --source bitbucket --repo myteam/myrepo
```

`--repo` (or `--project`) takes `workspace/repo_slug`. Import reads every milestone and issue, writes them under `.meta/`, then saves `.meta/sync/bitbucket-config.yaml` and `.meta/sync/bitbucket-state.json`. On a re-import, `--repo` overrides the workspace and repository in the config file.

Re-importing is idempotent. Entities are matched to earlier imports through the sync state and keep their id, path and local-only fields, such as `estimate`, extra labels and other trackers' sync blocks. Files whose content would not change are not rewritten.

`--link-strategy` does not apply to Bitbucket. Set `epic_linkage` in the config file instead.

After the first import, `gitpm push`, `gitpm pull` and `gitpm sync` detect Bitbucket from `bitbucket-config.yaml`. Pass `--adapter bitbucket` if the tree also holds another tracker's config.

### Configuration reference

**File:** `.meta/sync/bitbucket-config.yaml`

| Field | Required | Default | Meaning |
|---|---|---|---|
| `workspace` | Yes | | Workspace ID |
| `repo_slug` | Yes | | Repository slug |
| `base_url` | No | `https://api.bitbucket.org/2.0` | REST API base URL |
| `status_mapping` | No | `{}` | Overrides of the [status mapping](#bitbucket-status-mapping): Bitbucket state → gitpm status |
| `priority_mapping` | No | `{}` | Overrides of the [priority mapping](#bitbucket-priority-mapping): Bitbucket priority → gitpm priority |
| `kind_mapping` | No | `{}` | Overrides of the [kind labels](#bitbucket-kind-mapping): Bitbucket kind → gitpm label |
| `epic_linkage` | No | `both` | `component`, `body-marker` or `both`. See [Epic linkage](#epic-linkage). |
| `auto_sync` | No | `false` | Reserved for future use |

Each mapping is merged over the defaults, so list only the values you want to change:

```yaml
workspace: myteam
repo_slug: myrepo
status_mapping:
  on hold: todo          # treat "on hold" as todo instead of backlog
priority_mapping:
  trivial: medium
kind_mapping:
  bug: type:bug          # store the kind as "type:bug" instead of "kind:bug"
epic_linkage: body-marker
```

An unknown state, priority or kind, or an unknown gitpm status or priority, fails validation with `Invalid Bitbucket config`.

### Bitbucket status mapping

| Bitbucket state | gitpm status |
|---|---|
| `submitted`, `new`, `open` | `todo` |
| `on hold` | `backlog` |
| `resolved` | `done` |
| `closed`, `invalid`, `duplicate`, `wontfix` | `cancelled` |

In the other direction gitpm writes:

| gitpm status | Bitbucket state |
|---|---|
| `backlog` | `on hold` |
| `todo` | `new` |
| `in_progress`, `in_review` | `open` |
| `done` | `resolved` |
| `cancelled` | `closed` |

Bitbucket has no in-progress or in-review state, so `in_progress` and `in_review` are written as `open` and come back as `todo`.

When the issue's current state already maps to the entity's status, gitpm keeps it, so a `duplicate` issue is not rewritten to `closed`. Otherwise a state you mapped to that status in `status_mapping` wins over the default.

### Bitbucket priority mapping

| Bitbucket priority | gitpm priority |
|---|---|
| `trivial`, `minor` | `low` |
| `major` | `medium` |
| `critical` | `high` |
| `blocker` | `critical` |

gitpm writes `low` as `minor`, `medium` as `major`, `high` as `critical` and `critical` as `blocker`. The current priority and `priority_mapping` overrides are kept the same way as for status.

### Bitbucket kind mapping

Every Bitbucket issue has a kind. gitpm stores it as a label:

| Bitbucket kind | gitpm label |
|---|---|
| `bug` | `kind:bug` |
| `enhancement` | `kind:enhancement` |
| `proposal` | `kind:proposal` |
| `task` | `kind:task` |

On push the first kind label on the entity sets the kind. An entity without one is written as `task`.

### Epic linkage

Bitbucket issues have no parent, so gitpm needs another way to record which epic a story belongs to. `epic_linkage` picks it:

| Value | On push | On import |
|---|---|---|
| `component` | Sets the story's component to the epic title | The component names the epic |
| `body-marker` | Appends a hidden `<!-- gitpm:epic=<epic-id> -->` marker to the issue body | The marker names the epic |
| `both` (default) | Writes both | The marker wins; the component is the fallback |

The marker is stripped from the story body on import, so it never shows up in `.meta/`.

Components cannot be created over the API. If no component matches an epic title, push leaves the component unset and prints a warning. With `both`, the marker still links the story. With `component`, create a component for each epic in the repository settings first.

Epics are ordinary Bitbucket issues. On import an issue becomes an epic when:

1. an earlier import or push recorded it as an epic, or
2. its title starts with `[Epic]` (any case), or
3. another issue uses its title as its component (not with `body-marker` linkage).

Every other issue becomes a story.

### Push, pull and sync

`gitpm push` creates or updates an issue for every story and epic. `gitpm sync` runs a field-level three-way diff for each linked entity. `gitpm pull` runs the same sync with `remote-wins` as its default strategy. In both:

- a field changed on one side is copied to the other;
- a field changed on both sides is a conflict, resolved by `--strategy` (`ask` lists the conflict and leaves the entity untouched);
- new local entities are created as issues, locally deleted entities close their issue, and an issue deleted on Bitbucket cancels its entity.

A failure on one entity is reported and the run goes on. A checkpoint in `.gitpm/bitbucket-sync-checkpoint.json` lets the next run skip what already succeeded.

Field-level baselines are recorded by sync itself. Right after an import, a push or a state rebuild, gitpm only knows whether an entity changed, not which fields did. If it changed on both sides, every differing field is a conflict.

### Sync state and frontmatter

`.meta/sync/bitbucket-state.json` records the last-synced hash of every entity. Each synced entity also carries a `bitbucket:` block in its frontmatter (see the [schema reference](schema-reference.md#bitbucket-sync)). If the state file is missing, `gitpm sync` rebuilds it from those blocks.

The state file belongs to one repository. A run against another `workspace/repo_slug` stops with `Bitbucket sync state belongs to <workspace>/<repo>, not ...`.

### API behaviour

The adapter uses REST 2.0 only. It follows each page's `next` link, 50 items per page, and refuses links to another host so your token never leaves the configured API. It retries `429` responses (honouring `Retry-After`), `5xx` responses and network errors up to 3 times with exponential backoff.

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
| `JIRA_EMAIL` | Jira | Email of the Atlassian account that owns `JIRA_TOKEN` |
| `LINEAR_API_KEY` | Linear | Linear API key |
| `BITBUCKET_TOKEN` | Bitbucket | Atlassian API token, or a workspace or repository access token |
| `BITBUCKET_EMAIL` | Bitbucket | Email of the Atlassian account that owns an API token. Leave unset for an access token. |
