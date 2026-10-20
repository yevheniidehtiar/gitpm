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

# From Jira
gitpm import --source jira --site mycompany.atlassian.net --project-key PROJ

# From Linear
gitpm import --source linear --team <team-id>

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
priority_mapping:                    # Maps issue labels to GitPM priority
  priority:critical: critical
  priority:high: high
  priority:medium: medium
  priority:low: low
  P0: critical
  P1: high
  P2: medium
  P3: low
  critical: critical
  urgent: critical
auto_sync: false                     # Reserved for future use
```

### GitLab Configuration

**File:** `.meta/sync/gitlab-config.yaml`

```yaml
project: namespace/project           # Required: GitLab project path
project_id: 123                      # Required: GitLab project numeric ID
group_id: 45                         # Optional: group that owns the Epics, needed for --link-strategy native-epics
base_url: https://gitlab.com         # GitLab instance URL
status_mapping:                      # Keys are issue states (opened, closed) or label names
  opened: todo
  closed: done
  In Review: in_review               # An issue labelled "In Review" imports as in_review
label_mapping:
  epic_labels:
    - epic
auto_sync: false                     # Reserved for future use
```

GitLab specifics:

- **Status on import** is looked up in `status_mapping` by the first issue label that matches a key, then by the issue state (`opened` or `closed`). Neither matching maps to `todo`. The defaults are `opened: todo` and `closed: done`.
- **Status on push:** `done` and `cancelled` close the issue. Every other status reopens it.
- **Priority comes from the issue weight.** Nothing is written back on push.

    | Weight | GitPM priority |
    |---|---|
    | unset, `0`, `3`, `4` | `medium` |
    | `1`, `2` | `low` |
    | `5`, `6` | `high` |
    | `7` and above | `critical` |

- **`--link-strategy native-epics`** uses GitLab Epics, a Premium feature of groups. It needs `group_id` to point at the group that owns the epics.

### Jira Configuration

**File:** `.meta/sync/jira-config.yaml`

```yaml
site: mycompany.atlassian.net        # Required: Jira Cloud site
project_key: PROJ                    # Required: Jira project key
board_id: 12                         # Optional: sprints of this board become milestones
status_mapping:                      # Maps Jira status names to GitPM status
  To Do: todo
  In Progress: in_progress
  In Review: in_review
  Done: done
  Backlog: backlog
issue_type_mapping:
  epic_types:                        # Issues of these types become Epics
    - Epic
auto_sync: false                     # Reserved for future use
```

Jira specifics:

- **Jira Cloud only.** The adapter authenticates with HTTP Basic using `JIRA_EMAIL` and `JIRA_TOKEN` (or `--token`). Jira Server and Data Center are not supported.
- **Unknown statuses map to `todo`.** Edit `status_mapping` so every status of your workflow has an entry.
- **Sprints become milestones** when `board_id` is set. A closed sprint is `done`, every other sprint `in_progress`.
- **Priority** is mapped in both directions:

    | Jira priority | GitPM priority |
    |---|---|
    | `Highest`, `Blocker` | `critical` |
    | `High` | `high` |
    | `Low`, `Lowest` | `low` |
    | anything else | `medium` |

    On push gitpm writes `critical` as `Highest`, `high` as `High`, `low` as `Low` and `medium` as `Medium`.

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

The `status_mapping` maps the remote platform's status values to GitPM's standard status enum (`backlog`, `todo`, `in_progress`, `in_review`, `done`, `cancelled`). This section describes GitHub. For the other trackers see [GitLab](#gitlab-configuration), [Jira](#jira-configuration), [Linear](#linear-status-mapping) and [Bitbucket](#bitbucket-status-mapping).

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

This section describes GitHub. For the other trackers see [GitLab](#gitlab-configuration), [Jira](#jira-configuration), [Linear](#linear-priority-mapping) and [Bitbucket](#bitbucket-priority-mapping).

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

## Linear

The `@gitpm/sync-linear` adapter syncs stories, epics and cycles with one Linear team over the GraphQL API. One config file covers one team.

```bash
npm install -g @gitpm/cli @gitpm/sync-linear
```

### Linear authentication

Create a personal API key in Linear under **Settings > Security & access > Personal API keys** and export it:

```bash
export LINEAR_API_KEY="lin_api_..."
```

`--api-key` overrides `LINEAR_API_KEY`. The generic `--token` option is not used for Linear. The CLI fills it from `GITHUB_TOKEN` or `gh auth token`, and the adapter ignores it so a GitHub token never reaches Linear.

### Linear import

```bash
gitpm import --source linear --team <team-id>
```

`--team` takes the team id, a UUID. Find it in Linear under the team's settings, or ask the API:

```graphql
query { teams { nodes { id name key } } }
```

Import reads every cycle and issue of the team, writes them under `.meta/`, then saves `.meta/sync/linear-config.yaml` and `.meta/sync/linear-state.json`.

`--link-strategy` does not apply to Linear. Stories are linked to epics through the parent issue (see [Epics, stories and cycles](#epics-stories-and-cycles)).

After the first import, `gitpm push`, `gitpm pull` and `gitpm sync` detect Linear from `linear-config.yaml` and read the team from its `team_id`. Pass `--adapter linear` if the tree also holds another tracker's config.

### Linear configuration

**File:** `.meta/sync/linear-config.yaml`

| Field | Required | Default | Meaning |
|---|---|---|---|
| `team_id` | Yes | | Linear team id (UUID) |
| `status_mapping` | No | see [Linear status mapping](#linear-status-mapping) | Linear workflow state type → gitpm status |
| `auto_sync` | No | `false` | Reserved for future use |

```yaml
team_id: 0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b
status_mapping:                      # Keys are workflow state types, not state names
  triage: backlog
  backlog: backlog
  unstarted: todo
  started: in_progress
  completed: done
  canceled: cancelled
auto_sync: false
```

### Linear status mapping

Linear teams name their workflow states freely, so gitpm maps by the state **type**:

| Linear state type | gitpm status |
|---|---|
| `triage`, `backlog` | `backlog` |
| `unstarted` | `todo` |
| `started` | `in_progress` |
| `completed` | `done` |
| `canceled` | `cancelled` |

A state type missing from the mapping comes back as `todo`.

On push gitpm moves the issue to the team's first workflow state of the type that maps to the entity's status:

| gitpm status | Linear state type |
|---|---|
| `backlog` | `backlog` |
| `todo` | `unstarted` |
| `in_progress` | `started` |
| `done` | `completed` |
| `cancelled` | `canceled` |

When several types map to one status, as `triage` and `backlog` do by default, the type named like the status wins. Linear has no review state type, so `in_review` has no entry in the default mapping and push leaves the issue's workflow state as it is.

### Linear priority mapping

| Linear priority | gitpm priority |
|---|---|
| `1` (Urgent) | `critical` |
| `2` (High) | `high` |
| `3` (Medium), `0` (No priority) | `medium` |
| `4` (Low) | `low` |

gitpm writes `critical` as `1`, `high` as `2`, `medium` as `3` and `low` as `4`. An issue whose current priority already maps to the entity's priority is left alone, so "No priority" is not rewritten to Medium on every push.

### Epics, stories and cycles

Linear has no epic type. On import an issue with sub-issues becomes an epic and every other issue a story. A story's parent issue names its epic. On push a new story is created as a sub-issue of its epic's issue.

Cycles become milestones. The cycle's end date becomes `target_date`, a completed cycle is `done` and every other cycle `in_progress`. Cycles are managed in Linear: push and sync never create or change them.

### Linear push, pull and sync

`gitpm push` creates or updates an issue for every story and epic. `gitpm sync` compares each linked entity's content hash with the local and remote hashes recorded at the last sync. `gitpm pull` runs the same sync with `remote-wins` as its default strategy. In both:

- an entity changed only locally is pushed, one changed only in Linear is pulled;
- an entity changed on both sides is a conflict, resolved as a whole by `--strategy` (`ask` lists the conflict and leaves the entity untouched);
- new local entities are created as issues, locally deleted entities move their issue to the team's first `completed` state, and an issue deleted in Linear cancels its entity.

Conflicts are resolved per entity, not per field as with Bitbucket. The state file is updated after every entity, so a run that stops halfway does not report the entities it already synced as conflicts next time.

### Linear sync state and frontmatter

`.meta/sync/linear-state.json` records the team id and the last-synced hashes of every entity. Each synced entity also carries a `linear:` block in its frontmatter with `issue_id`, `identifier` (such as `ENG-42`), `team_id`, `cycle_id`, `last_sync_hash` and `synced_at` (see the [schema reference](schema-reference.md#linear-sync)).

`gitpm sync` needs the state file and stops with `No Linear sync state found` when it is missing. `gitpm push` does not: it links every entity that carries a `linear:` block to its issue and rebuilds the state entry from it. After losing the state file, run `gitpm push` once, then `gitpm sync`.

### Linear limitations

- **One team per config.** `team_id` names one team and the state file belongs to it. Use a separate `.meta/` tree per team.
- **No review state.** Linear has no review state type, so `in_review` is never written on push.
- **No "No priority".** Linear's priority `0` imports as `medium`. It survives a push only while the entity's priority stays `medium`.
- **Cycles are read-only.** Milestones are imported from cycles and never created or updated in Linear.
- **The team must exist.** gitpm creates missing labels on push, but never teams, workflow states or users. An assignee unknown to the team is left unchanged.
- **The API key is personal.** Issues created on push are attributed to the key's owner.

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
| `LINEAR_API_KEY` | Linear | Personal API key; `--api-key` overrides it |
| `BITBUCKET_TOKEN` | Bitbucket | Atlassian API token, or a workspace or repository access token |
| `BITBUCKET_EMAIL` | Bitbucket | Email of the Atlassian account that owns an API token. Leave unset for an access token. |
