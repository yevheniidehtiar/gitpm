# @gitpm/sync-jira

Jira Cloud sync adapter for [gitpm](https://github.com/yevheniidehtiar/gitpm). Syncs stories, epics and sprints in `.meta/` with Jira issues and boards, in both directions.

## Install

```bash
npm install -g @gitpm/cli @gitpm/sync-jira
```

The CLI discovers installed adapters at runtime. Nothing to configure.

## Authentication

Jira Cloud only. The adapter authenticates with your Atlassian account email and an API token (HTTP Basic). The token comes from `--token`, then `JIRA_TOKEN`. The email is read from `JIRA_EMAIL`. Jira Server and Data Center are not supported. Never write the token into `.meta/sync/*.yaml`.

## Import

```bash
gitpm import --source jira --site mycompany.atlassian.net --project-key PROJ
```

Import writes `.meta/sync/jira-config.yaml` and `.meta/sync/jira-state.json`. After that, `gitpm push`, `gitpm pull` and `gitpm sync` detect Jira from the config file. Pass `--adapter jira` if the tree also holds another tracker's config.

## Configuration

`.meta/sync/jira-config.yaml`:

```yaml
site: mycompany.atlassian.net
project_key: PROJ
board_id: 12                      # optional, sprints on this board become milestones
status_mapping:                   # Jira status name -> gitpm status
  To Do: todo
  In Progress: in_progress
  In Review: in_review
  Done: done
  Backlog: backlog
issue_type_mapping:
  epic_types: [Epic]              # issue types that become epics
auto_sync: false
```

An unknown Jira status maps to `todo`. Priority: `Highest` and `Blocker` import as `critical`, `High` as `high`, `Low` and `Lowest` as `low`, anything else as `medium`. Push writes `critical` as `Highest`, `high` as `High`, `low` as `Low` and the rest as `Medium`. With `board_id` set, a closed sprint becomes a `done` milestone and any other sprint `in_progress`. Full reference: https://yevheniidehtiar.github.io/gitpm/sync-guide/#jira-configuration

## Programmatic use

```ts
import type { SyncAdapter } from '@gitpm/core';
import { jiraAdapter, importFromJira } from '@gitpm/sync-jira';

const adapter: SyncAdapter = jiraAdapter;
const result = await importFromJira({ metaDir: '.meta', site, projectKey: 'PROJ', email, apiToken });
if (!result.ok) console.error(result.error.message);
```

Every function returns `Result<T, E>` and never throws.

## Links

Docs: https://yevheniidehtiar.github.io/gitpm/ · Repo: https://github.com/yevheniidehtiar/gitpm · License: MIT
