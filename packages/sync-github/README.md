# @gitpm/sync-github

GitHub sync adapter for [gitpm](https://github.com/yevheniidehtiar/gitpm). Syncs stories, epics and milestones in `.meta/` with GitHub Issues, Milestones and Projects v2 boards, in both directions.

## Install

```bash
npm install -g @gitpm/cli @gitpm/sync-github
```

The CLI discovers installed adapters at runtime. Nothing to configure.

## Authentication

The token comes from `--token`, then `GITHUB_TOKEN`, then `gh auth token` if the GitHub CLI is logged in. It needs the `repo` scope, plus `project` when you sync a Projects v2 board. Never write the token into `.meta/sync/*.yaml`.

## Import

```bash
gitpm import --source github --repo owner/repo
gitpm import --source github --repo owner/repo --project 5   # with a Projects v2 board
```

Import writes `.meta/sync/github-config.yaml` and `.meta/sync/github-state.json`. After that, `gitpm push`, `gitpm pull` and `gitpm sync` detect GitHub from the config file. Pass `--adapter github` if the tree also holds another tracker's config.

## Configuration

`.meta/sync/github-config.yaml`:

```yaml
repo: owner/repo
project_number: 5                 # optional, Projects v2 board
status_mapping:                   # Project status name -> gitpm status
  Todo: todo
  In Progress: in_progress
  In Review: in_review
  Done: done
  Backlog: backlog
label_mapping:
  epic_labels: [epic]             # issues with these labels become epics
priority_mapping:                 # label -> gitpm priority
  priority:critical: critical
  priority:high: high
  priority:medium: medium
  priority:low: low
auto_sync: false
```

The default `priority_mapping` also covers `P0`..`P3`, `critical` and `urgent`. Full reference: https://yevheniidehtiar.github.io/gitpm/sync-guide/#github-configuration

## Programmatic use

```ts
import type { SyncAdapter } from '@gitpm/core';
import { githubAdapter, importFromGitHub } from '@gitpm/sync-github';

const adapter: SyncAdapter = githubAdapter;
const result = await importFromGitHub({ metaDir: '.meta', repo: 'owner/repo', token });
if (!result.ok) console.error(result.error.message);
```

Every function returns `Result<T, E>` and never throws.

## Links

Docs: https://yevheniidehtiar.github.io/gitpm/ · Repo: https://github.com/yevheniidehtiar/gitpm · License: MIT
