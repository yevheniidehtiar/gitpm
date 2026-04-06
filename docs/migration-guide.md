# Migration Guide

This guide covers importing existing project data into GitPM from GitHub Issues, GitLab, or Jira.

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

---

## From Jira

Jira import follows the same pattern. After import, GitPM maps Jira workflow statuses to its standard status enum via the `workflow_mapping` in `.meta/sync/jira-config.yaml`.

```bash
export JIRA_TOKEN="your-api-token"
gitpm import --source jira --project PROJ \
  --base-url https://mycompany.atlassian.net
```

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

One of GitPM's key use cases is providing project context to AI agents. After importing, agents can read the `.meta/` directory to understand:

- What work is planned (roadmap, milestones)
- What's in progress (epics, stories with status)
- How work is organized (epic-story hierarchy)
- What's been completed (done stories, closed milestones)

This gives AI agents structured project context without needing API access to your issue tracker.
