# Migration Guide

This guide covers importing existing project data into GitPM from GitHub Issues, GitLab, Jira, Linear or Bitbucket Cloud.

## From GitHub Issues

### Prerequisites

- A GitHub personal access token with `repo` scope
- The repository in `owner/repo` format

### Basic Import

```bash
export GITHUB_TOKEN="ghp_..."
gitpm import --repo myorg/myrepo
```

This imports all open and closed issues and milestones from the repository.

### With a GitHub Project Board

If your repository uses a GitHub Project (v2), you can include project status data:

```bash
gitpm import --repo myorg/myrepo --project 5
```

The project number is visible in the project URL: `github.com/orgs/myorg/projects/5`.

When a project is specified, the sync engine maps the project's status field (e.g., "Todo", "In Progress", "Done") to GitPM's status enum. Without a project, status is inferred from issue state (`open` = `todo`, `closed` = `done`).

### Epic Detection

By default, issues with an `epic` label are treated as Epics. All other issues become Stories. You can customize this after import by editing `.meta/sync/github-config.yaml`:

```yaml
label_mapping:
  epic_labels:
    - epic
    - theme
    - initiative
```

### Link Strategies

GitPM uses link strategies to determine which stories belong to which epics. Use `--link-strategy` to control this:

```bash
# Use all strategies (default, recommended)
gitpm import --repo myorg/myrepo --link-strategy all

# Only use GitHub sub-issue relationships
gitpm import --repo myorg/myrepo --link-strategy sub-issues

# Only use milestone grouping
gitpm import --repo myorg/myrepo --link-strategy milestone
```

Available strategies for GitHub:

| Strategy | Description |
|----------|-------------|
| `all` | Combine all strategies (default) |
| `body-refs` | Parse issue bodies for references like `#123` |
| `sub-issues` | Use GitHub's sub-issue feature |
| `milestone` | Group by shared milestone |
| `labels` | Match stories to epics by label |

---

## From GitLab

### Prerequisites

- A GitLab personal access token with `api` scope
- The project path in `namespace/project` format

### Basic Import

```bash
export GITLAB_TOKEN="glpat-..."
gitpm import --source gitlab --project mygroup/myproject
```

The adapter reads `GITLAB_TOKEN`; `--token` overrides it.

GitLab has no priority field, so gitpm maps issue weight to priority: 1-2 `low`, 3-4 `medium`, 5-6 `high`, 7 and above `critical`, unset `medium`.

### Self-Hosted GitLab

```bash
gitpm import --source gitlab --project mygroup/myproject \
  --base-url https://gitlab.mycompany.com
```

### Link Strategies for GitLab

| Strategy | Description |
|----------|-------------|
| `all` | Combine all strategies (default) |
| `body-refs` | Parse issue bodies for references |
| `native-epics` | Use GitLab's native epic feature |
| `milestone` | Group by shared milestone |
| `labels` | Match by label |

```bash
gitpm import --source gitlab --project mygroup/myproject --link-strategy native-epics
```

`native-epics` needs the project to belong to a group with Epics (GitLab Premium) and `group_id` set in `.meta/sync/gitlab-config.yaml`. Import sets it when it can.

---

## From Jira

### Prerequisites

- Jira Cloud. The adapter authenticates with an email address and an API token. Jira Server and Data Center are not supported.
- An API token for a user who can read and transition issues in the project. The adapter reads `JIRA_TOKEN` and `JIRA_EMAIL`; `--token` overrides the token.
- Your site host (for example `mycompany.atlassian.net`) and the project key (for example `PROJ`).
- `@gitpm/sync-jira` installed next to `@gitpm/cli`.

### Import

```bash
export JIRA_TOKEN="your-api-token"
export JIRA_EMAIL="you@example.com"
gitpm import --source jira --site mycompany.atlassian.net --project-key PROJ
```

`--base-url https://mycompany.atlassian.net` and `--project PROJ` still work as aliases for `--site` and `--project-key`.

Issues of type Epic become epics. Issues linked to an epic become its stories under `.meta/epics/<epic>/stories/`. Everything else lands in `.meta/stories/`. When `board_id` is set in `.meta/sync/jira-config.yaml`, sprints become milestones: a closed sprint is `done`, any other sprint is `in_progress`.

### Map your workflow

Jira workflows rarely match GitPM's six statuses out of the box. Edit `status_mapping` in `.meta/sync/jira-config.yaml` so every Jira status name maps to one of `backlog`, `todo`, `in_progress`, `in_review`, `done` or `cancelled`. The defaults are:

| Jira status | GitPM status |
|-------------|--------------|
| `To Do` | `todo` |
| `In Progress` | `in_progress` |
| `In Review` | `in_review` |
| `Done` | `done` |
| `Backlog` | `backlog` |
| anything else | `todo` |

`issue_type_mapping.epic_types` (default `['Epic']`) lists the issue types that become epics. Priority maps Highest and Blocker to `critical`, High to `high`, Low and Lowest to `low`, and everything else to `medium`. See [Jira Configuration](sync-guide.md#jira-configuration) in the sync guide for the full file.

### Confluence pages

There is no Confluence importer. Export requirement pages to Markdown and store them as `.meta/prds/<slug>/prd.md` so agents read them next to the code. [Adopting agentic coding alongside Jira and Confluence](adopting-agentic-coding.md) walks through this and through who should win sync conflicts.

---

## From Linear

### Prerequisites

- A Linear personal API key from Settings > API. The adapter reads `LINEAR_API_KEY`; `--api-key` overrides it.
- The team id. It is the UUID shown in Linear team settings, or returned by the GraphQL API.
- `@gitpm/sync-linear` installed next to `@gitpm/cli`.

### Import

```bash
export LINEAR_API_KEY="lin_api_..."
gitpm import --source linear --team <team-id>
```

Import writes the team id to `team_id` in `.meta/sync/linear-config.yaml`. `gitpm push`, `pull` and `sync` read it from there.

### How entities map

- An issue with sub-issues becomes an epic. Its sub-issues become stories under `.meta/epics/<epic>/stories/`.
- A leaf issue becomes a story in `.meta/stories/`.
- A cycle becomes a milestone. A completed cycle is `done`, any other cycle is `in_progress`. The cycle end date becomes `target_date`.

Each imported file carries a `linear` frontmatter block with `issue_id`, `identifier` (for example `ENG-42`), `team_id`, `cycle_id`, `last_sync_hash` and `synced_at`.

### Status by state type

`status_mapping` in `linear-config.yaml` is keyed by the Linear workflow state type, not the state name:

| Linear state type | GitPM status |
|-------------------|--------------|
| `triage` | `backlog` |
| `backlog` | `backlog` |
| `unstarted` | `todo` |
| `started` | `in_progress` |
| `completed` | `done` |
| `canceled` | `cancelled` |
| anything else | `todo` |

### Priority

| Linear priority | GitPM priority |
|-----------------|----------------|
| 1 (Urgent) | `critical` |
| 2 (High) | `high` |
| 3 (Medium) | `medium` |
| 4 (Low) | `low` |
| 0 (No priority) | `medium` |

On push, `critical` becomes 1, `high` 2, `low` 4 and everything else 3.

See [Linear](sync-guide.md#linear) in the sync guide for the full configuration file.

---

## From Bitbucket Cloud

### Prerequisites

- A Bitbucket Cloud token. The adapter reads `BITBUCKET_TOKEN`; `--token` overrides it. For an Atlassian API token, also set `BITBUCKET_EMAIL`.
- The repository in `workspace/repo_slug` format, with the issue tracker enabled.
- `@gitpm/sync-bitbucket` installed next to `@gitpm/cli`.

### Import

```bash
export BITBUCKET_TOKEN="..."
gitpm import --source bitbucket --repo myworkspace/myrepo
```

Bitbucket issues have no epic type. An issue becomes an epic when its title starts with `[Epic]`, or when another issue uses its title as its component. Everything else becomes a story. `--link-strategy` does not apply; set `epic_linkage` in `.meta/sync/bitbucket-config.yaml` instead. See [Bitbucket Cloud](sync-guide.md#bitbucket-cloud) in the sync guide for authentication options, status and priority mapping and epic linkage.

---

## Post-Import Steps

After importing from any platform, follow these steps:

### 1. Validate the import

```bash
gitpm validate
```

Fix any validation errors. Common issues:

- **Orphaned references** — an entity references another entity that wasn't imported. This can happen with cross-repo references.
- **Status inconsistencies** — an epic marked as `done` with `in_progress` stories. Review and update statuses.

### 2. Review the directory structure

```bash
ls -R .meta/
```

Verify that epics, stories, and milestones are organized as expected. Stories should be nested under their parent epic in `.meta/epics/<epic-slug>/stories/`.

### 3. Customize the sync configuration

Edit `.meta/sync/github-config.yaml` (or the equivalent for your platform) to adjust:

- **Status mapping** — match your project's workflow stages
- **Epic labels** — configure which labels identify epic-type issues
- **Priority mapping** — map your label conventions to GitPM priorities

### 4. Commit the .meta/ directory

```bash
git add .meta/
git commit -m "feat: import project management data from GitHub"
```

The `.meta/` directory and sync state should be committed to your repository so all team members share the same project data and sync state.

### 5. Start the sync workflow

```bash
# Make changes locally, then push
gitpm push

# Or pull the latest from remote
gitpm pull

# Or do both
gitpm sync
```

---

## Tips

### Large Repositories

For repositories with many issues (500+), the initial import may take a few minutes due to API rate limiting. The import engine automatically handles pagination and respects rate limits.

### Incremental Updates

After the initial import, use `gitpm pull` or `gitpm sync` to fetch new issues. You don't need to re-import from scratch.

### Keeping Both Systems in Sync

GitPM is designed to coexist with your existing issue tracker. Team members can continue using GitHub Issues (or GitLab/Jira) while others work with `.meta/` files. Use `gitpm sync` regularly to keep both sides up to date.

### Re-importing

If you need to start fresh (e.g., after significant changes to your remote project structure):

```bash
rm -rf .meta/
gitpm import --repo owner/repo
```

This creates a clean `.meta/` tree with fresh sync state.

### Working with AI Agents

After import, agents read `.meta/` for planned, in-progress and finished work without any tracker API access. Give them rules too. This repository's [`AGENTS.md`](https://github.com/yevheniidehtiar/gitpm/blob/master/AGENTS.md) shows the shape (commands, verification gate, story lifecycle, boundaries), the [Agent Setup Guide](AGENT_SETUP_GUIDE.md) walks an agent through installing GitPM in your repo, and [Adopting agentic coding alongside Jira and Confluence](adopting-agentic-coding.md) covers the team-level trust model and sync strategy.
