# @gitpm/sync-linear

Linear sync adapter for [gitpm](https://github.com/yevheniidehtiar/gitpm). Syncs stories, epics and cycles in `.meta/` with the issues of one Linear team, in both directions.

## Install

```bash
npm install -g @gitpm/cli @gitpm/sync-linear
```

The CLI discovers installed adapters at runtime. Nothing to configure.

## Authentication

The adapter uses a Linear personal API key, read from `--api-key` or `LINEAR_API_KEY`. Never write the key into `.meta/sync/*.yaml`.

## Import

```bash
gitpm import --source linear --team <team-id>
```

`--team` takes the team UUID shown in Linear team settings or returned by the GraphQL API. Import writes `.meta/sync/linear-config.yaml` and `.meta/sync/linear-state.json`. After that, `gitpm push`, `gitpm pull` and `gitpm sync` read the team from `team_id` in the config file. Pass `--adapter linear` if the tree also holds another tracker's config.

## Configuration

`.meta/sync/linear-config.yaml`:

```yaml
team_id: 0c7a1b2e-...             # Linear team UUID
status_mapping:                   # Linear workflow state type -> gitpm status
  triage: backlog
  backlog: backlog
  unstarted: todo
  started: in_progress
  completed: done
  canceled: cancelled
auto_sync: false
```

An unknown state type maps to `todo`. An issue with sub-issues becomes an epic, a leaf issue a story. Priority: Linear `1` imports as `critical`, `2` as `high`, `4` as `low`, `0` and `3` as `medium`. Push writes `critical` as `1`, `high` as `2`, `low` as `4` and the rest as `3`. Cycles become milestones: a completed cycle is `done`, any other `in_progress`, with the cycle end date as `target_date`. Each synced entity carries a `linear:` frontmatter block with `issue_id`, `identifier` (for example `ENG-42`), `team_id`, `cycle_id`, `last_sync_hash` and `synced_at`. Full reference: https://yevheniidehtiar.github.io/gitpm/sync-guide/#linear

## Programmatic use

```ts
import type { SyncAdapter } from '@gitpm/core';
import { linearAdapter, importFromLinear } from '@gitpm/sync-linear';

const adapter: SyncAdapter = linearAdapter;
const result = await importFromLinear({ metaDir: '.meta', teamId, apiKey });
if (!result.ok) console.error(result.error.message);
```

Every function returns `Result<T, E>` and never throws.

## Links

Docs: https://yevheniidehtiar.github.io/gitpm/ · Repo: https://github.com/yevheniidehtiar/gitpm · License: MIT
