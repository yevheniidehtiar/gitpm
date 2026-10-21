# @gitpm/sync-gitlab

GitLab sync adapter for [gitpm](https://github.com/yevheniidehtiar/gitpm). Syncs stories, epics and milestones in `.meta/` with GitLab Issues and Milestones, on gitlab.com or a self-hosted instance, in both directions.

## Install

```bash
npm install -g @gitpm/cli @gitpm/sync-gitlab
```

The CLI discovers installed adapters at runtime. Nothing to configure.

## Authentication

The token comes from `--token`, then `GITLAB_TOKEN`. Use a personal or project access token with the `api` scope. Never write the token into `.meta/sync/*.yaml`.

## Import

```bash
gitpm import --source gitlab --project namespace/project
gitpm import --source gitlab --project namespace/project --base-url https://gitlab.mycompany.com
```

Import writes `.meta/sync/gitlab-config.yaml` and `.meta/sync/gitlab-state.json`. After that, `gitpm push`, `gitpm pull` and `gitpm sync` detect GitLab from the config file. Pass `--adapter gitlab` if the tree also holds another tracker's config.

## Configuration

`.meta/sync/gitlab-config.yaml`:

```yaml
project: namespace/project
project_id: 123
group_id: 45                      # optional, needed for native epics (GitLab Premium)
base_url: https://gitlab.com
status_mapping:                   # issue state (opened, closed) or label name -> gitpm status
  opened: todo
  closed: done
label_mapping:
  epic_labels: [epic]             # issues with these labels become epics
auto_sync: false
```

On import the first label that matches a `status_mapping` key wins, then the issue state, then `todo`. Priority comes from the issue weight: 1-2 `low`, 3-4 `medium`, 5-6 `high`, 7 and above `critical`, no weight `medium`. On push, `done` and `cancelled` close the issue and any other status reopens it; priority is not written back. Full reference: https://yevheniidehtiar.github.io/gitpm/sync-guide/#gitlab-configuration

## Programmatic use

```ts
import type { SyncAdapter } from '@gitpm/core';
import { gitlabAdapter, importFromGitLab } from '@gitpm/sync-gitlab';

const adapter: SyncAdapter = gitlabAdapter;
const result = await importFromGitLab({ metaDir: '.meta', project: 'namespace/project', token });
if (!result.ok) console.error(result.error.message);
```

Every function returns `Result<T, E>` and never throws.

## Links

Docs: https://yevheniidehtiar.github.io/gitpm/ · Repo: https://github.com/yevheniidehtiar/gitpm · License: MIT
