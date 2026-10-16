---
title: gitpm
description: Git-native project management. Roadmaps, epics and stories as Markdown files in your repo, synced with GitHub, GitLab and Jira.
---

# gitpm

**gitpm keeps your roadmap, epics and stories as Markdown files in `.meta/` inside your repository and syncs them both ways with GitHub, GitLab or Jira.**

Your tracker stays the team's UI. The repository becomes the source of truth that you, your reviewers and your AI coding agents can read, diff and edit like any other code.

[Get started](getting-started.md){ .md-button .md-button--primary }
[Try the live demo](https://yevheniidehtiar.github.io/gitpm/demo/){ .md-button }

## Install

gitpm is a Node.js CLI. Install it with the sync adapter for your tracker:

```bash
npm install -g @gitpm/cli @gitpm/sync-github   # or @gitpm/sync-gitlab, @gitpm/sync-jira
```

## Quick start

Start from an empty tree, or import an existing GitHub repository:

=== "Start empty"

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

=== "Import from GitHub"

    ```console
    $ gitpm import --repo owner/repo
    ✔ Import complete.

    Summary:
      Milestones: …
      Epics:      …
      Stories:    …
      Files:      …
    ```

    The token comes from `--token`, then `GITHUB_TOKEN`, then `gh auth token`.

Then validate, edit and push:

```console
$ gitpm validate
✓ .meta/ tree is valid (4 entities)

$ gitpm create story --title "Add OAuth callback" --priority high
✓ Created story 1agulqSuPecm at .meta/stories/add-oauth-callback.md

$ gitpm set .meta/stories/add-oauth-callback.md status=in_progress

$ gitpm push --dry-run   # preview what changes on the tracker
$ gitpm push             # create and update issues and milestones
```

The [getting started guide](getting-started.md) walks through tokens, adapters and connecting a fresh tree to a tracker.

## Why gitpm

<div class="grid cards" markdown>

-   :material-file-tree:{ .lg .middle } __Project management as files__

    ---

    Roadmaps, milestones, epics, stories and PRDs are Markdown with YAML frontmatter, validated by zod schemas. `grep`, `git blame` and your editor all work.

    [:octicons-arrow-right-24: Schema reference](schema-reference.md)

-   :material-sync:{ .lg .middle } __Bidirectional sync__

    ---

    `push`, `pull` and `sync` against GitHub Issues and Projects, GitLab or Jira, with content hashing and field-level conflict resolution.

    [:octicons-arrow-right-24: Sync guide](sync-guide.md)

-   :material-robot-outline:{ .lg .middle } __Built for AI agents__

    ---

    Agents read the full project context from the file tree without API calls, and update status through the CLI. `gitpm init` installs a Claude Code skill.

    [:octicons-arrow-right-24: Adopting agentic coding](adopting-agentic-coding.md)

-   :material-source-pull:{ .lg .middle } __Code and context in one PR__

    ---

    The story update travels with the code that implements it. Reviewers see what changed and why in the same diff.

    [:octicons-arrow-right-24: Product demo](product-demo.md)

-   :material-history:{ .lg .middle } __Auditable history__

    ---

    Every status change, priority bump and scope edit is a Git commit, with full `log`, `diff` and `blame`.

    [:octicons-arrow-right-24: Architecture](architecture.md)

-   :material-wifi-off:{ .lg .middle } __Offline-first__

    ---

    Plan and update work without network access, including in air-gapped environments. Sync when you are back online.

    [:octicons-arrow-right-24: CLI reference](cli-reference.md)

</div>

## Links

- **Live demo** of the web UI, running on this repository's own `.meta/` tree: [yevheniidehtiar.github.io/gitpm/demo/](https://yevheniidehtiar.github.io/gitpm/demo/)
- **Source** on GitHub: [yevheniidehtiar/gitpm](https://github.com/yevheniidehtiar/gitpm)
- **Packages** on npm: [`@gitpm/cli`](https://www.npmjs.com/package/@gitpm/cli), [`@gitpm/core`](https://www.npmjs.com/package/@gitpm/core), [`@gitpm/sync-github`](https://www.npmjs.com/package/@gitpm/sync-github), [`@gitpm/sync-gitlab`](https://www.npmjs.com/package/@gitpm/sync-gitlab), [`@gitpm/sync-jira`](https://www.npmjs.com/package/@gitpm/sync-jira)
