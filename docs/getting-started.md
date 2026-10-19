---
title: Getting started
description: Install gitpm, connect it to GitHub, GitLab, Jira or Bitbucket, and push your first change.
---

# Getting started

This guide takes you from an empty repository to a `.meta/` tree that is validated and synced with your issue tracker. It takes about five minutes.

If you want an AI agent to do the setup for you, point it at the [agent setup guide](AGENT_SETUP_GUIDE.md) instead.

## Prerequisites

- Node.js 22.12 or newer (Bun works too)
- A Git repository that will hold `.meta/`
- Optional: an access token for your tracker with read and write access to issues

## 1. Install the CLI and an adapter

The CLI and the sync adapters are separate npm packages. Install the CLI plus the adapter for each tracker you use:

=== "GitHub"

    ```bash
    npm install -g @gitpm/cli @gitpm/sync-github
    ```

=== "GitLab"

    ```bash
    npm install -g @gitpm/cli @gitpm/sync-gitlab
    ```

=== "Jira"

    ```bash
    npm install -g @gitpm/cli @gitpm/sync-jira
    ```

=== "Bitbucket"

    ```bash
    npm install -g @gitpm/cli @gitpm/sync-bitbucket
    ```

Adapters are discovered at runtime, so there is nothing else to configure. Check the install:

```bash
gitpm --help
```

## 2. Provide a token

For GitHub, gitpm looks for a token in this order:

1. the `--token <token>` flag
2. the `GITHUB_TOKEN` environment variable
3. the GitHub CLI, via `gh auth token`

If you already use `gh`, run `gh auth login` once and skip this step. Otherwise:

```bash
export GITHUB_TOKEN="ghp_..."
```

Other trackers read their own variables, and `--token` always overrides them:

| Tracker | Variables |
|---|---|
| GitLab | `GITLAB_TOKEN` |
| Jira | `JIRA_TOKEN`, `JIRA_EMAIL` |
| Linear | `LINEAR_API_KEY` |
| Bitbucket Cloud | `BITBUCKET_TOKEN`, plus `BITBUCKET_EMAIL` for an Atlassian API token. Leave the email unset for a workspace or repository access token. |

The [sync guide](sync-guide.md) covers the per-platform settings, including [Bitbucket token scopes](sync-guide.md#authentication).

!!! warning "Keep tokens out of the repository"
    Never write tokens into `.meta/sync/*.yaml`, commit messages or CI logs. gitpm only reads them from the flag, the environment or `gh`.

## 3. Create or import a `.meta/` tree

You have two options.

=== "Import an existing project"

    Pull your current issues and milestones into files:

    ```bash
    cd /path/to/your/repo
    gitpm import --repo owner/repo                    # GitHub
    gitpm import --repo owner/repo --project 5        # GitHub, including a Projects (v2) board
    gitpm import --source gitlab --project group/proj  # GitLab
    gitpm import --source bitbucket --repo workspace/repo_slug  # Bitbucket Cloud
    ```

    Expected output ends with:

    ```text
    ✔ Import complete.

    Summary:
      Milestones: 3
      Epics:      5
      Stories:    42
      Files:      52
    ```

    Import also writes `.meta/sync/github-config.yaml` (or the GitLab, Jira or Bitbucket equivalent) and a `*-state.json` file. The [migration guide](migration-guide.md) explains how issues are mapped to epics and stories.

=== "Start from scratch"

    Scaffold an example tree:

    ```console
    $ gitpm init my-project
    .meta/
      epics/
        initial-setup/
          epic.md
          stories/
            project-scaffolding.md
      roadmap/
        milestones/
          mvp-launch.md
        roadmap.yaml

    ✓ Created 4 files in .meta/
    ✓ Installed Claude Code skill at .claude/skills/gitpm/SKILL.md
    ```

    Pass `--no-claude-skill` to skip the Claude Code skill.

    To sync this tree with GitHub later, create `.meta/sync/github-config.yaml` with at least the repository:

    ```yaml
    repo: owner/repo
    ```

    See the [sync guide](sync-guide.md#configuration-files) for every option.

## 4. Validate

```console
$ gitpm validate
✓ .meta/ tree is valid (4 entities)
```

Errors print one per line with the file, the entity ID and an error code such as `UNRESOLVED_REF` or `DUPLICATE_ID`, and the command exits non-zero. Run it in CI to keep the tree consistent.

Commit the tree, including `.meta/sync/*-state.json`. The state file holds the content hashes that make later syncs incremental.

```bash
git add .meta/
git commit -m "chore(pm): add .meta/ project tree"
```

## 5. Make a change

Every entity is a Markdown file with YAML frontmatter, so you can edit it in your editor. The CLI is safer for frontmatter because it validates values and keeps key order and sync metadata intact:

```console
$ gitpm create story --title "Add OAuth callback" --priority high
✓ Created story 1agulqSuPecm at .meta/stories/add-oauth-callback.md

$ gitpm set .meta/stories/add-oauth-callback.md status=in_progress
$ gitpm query --type story --status in_progress
```

Status values are `backlog`, `todo`, `in_progress`, `in_review`, `done` and `cancelled`. Priorities are `low`, `medium`, `high` and `critical`. The [schema reference](schema-reference.md) lists every field.

## 6. Push to your tracker

Preview first, then push:

```console
$ gitpm push --dry-run

Changes to push:
  New milestones: 0
  New issues:     1
  Updated milestones: 0
  Updated issues:     0
  Total changes:  1

$ gitpm push
```

`push` asks for confirmation unless you pass `--yes`. Afterwards, use `gitpm pull` to fetch remote edits and `gitpm sync` to do both, with `--strategy local-wins`, `remote-wins` or `ask` for conflicts.

## Next steps

- [Sync configuration](sync-guide.md): status, priority and label mapping, conflict strategies
- [CLI reference](cli-reference.md): all commands and flags
- [Migration guide](migration-guide.md): moving from GitHub Issues, GitLab or Jira
- [Adopting agentic coding](adopting-agentic-coding.md): using gitpm with AI agents on a team that stays on Jira and Confluence
- [Live demo](https://yevheniidehtiar.github.io/gitpm/demo/): the web UI running on gitpm's own `.meta/` tree
