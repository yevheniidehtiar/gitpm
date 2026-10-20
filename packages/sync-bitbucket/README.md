# @gitpm/sync-bitbucket

Bitbucket Cloud sync adapter for [gitpm](https://github.com/yevheniidehtiar/gitpm). Syncs stories, epics and milestones in `.meta/` with the issue tracker of one Bitbucket Cloud repository, in both directions.

Bitbucket **Cloud** only. Bitbucket Data Center and Server have no issue tracker and hand issues off to Jira, so use `@gitpm/sync-jira` there. The repository must have its issue tracker enabled.

## Install

```bash
npm install -g @gitpm/cli @gitpm/sync-bitbucket
```

The CLI discovers installed adapters at runtime. Nothing to configure.

## Authentication

The adapter accepts two kinds of token and picks one by whether an email is set:

| Token | Set | Sent as | Use when |
|---|---|---|---|
| Atlassian API token | `BITBUCKET_TOKEN` and `BITBUCKET_EMAIL` | HTTP Basic, `email:token` | Personal use |
| Workspace or repository access token | `BITBUCKET_TOKEN` only | `Bearer` token | CI and bots |

`--token` overrides `BITBUCKET_TOKEN`. The email is read only from `BITBUCKET_EMAIL`. For an Atlassian API token grant `read:repository:bitbucket`, `read:issue:bitbucket` and `write:issue:bitbucket`. For an access token grant **Repositories: Read**, **Issues: Read** and **Issues: Write**. App passwords are deprecated by Atlassian and are not supported. Never write the token into `.meta/sync/*.yaml`.

## Import

```bash
gitpm import --source bitbucket --repo workspace/repo_slug
```

Import reads every milestone and issue, writes them under `.meta/`, then saves `.meta/sync/bitbucket-config.yaml` and `.meta/sync/bitbucket-state.json`. Re-import is idempotent. After that, `gitpm push`, `gitpm pull` and `gitpm sync` detect Bitbucket from the config file. Pass `--adapter bitbucket` if the tree also holds another tracker's config.

## Configuration

`.meta/sync/bitbucket-config.yaml`. Each mapping is merged over the defaults, so list only what you change:

```yaml
workspace: myteam
repo_slug: myrepo
base_url: https://api.bitbucket.org/2.0
status_mapping:                   # Bitbucket state -> gitpm status
  on hold: todo
priority_mapping:                 # Bitbucket priority -> gitpm priority
  trivial: medium
kind_mapping:                     # Bitbucket kind -> gitpm label
  bug: type:bug
epic_linkage: both                # component, body-marker or both
auto_sync: false
```

Bitbucket has no issue hierarchy and no labels. A story's epic is recorded by `epic_linkage`: the issue component named after the epic title, a hidden `<!-- gitpm:epic=<id> -->` marker in the issue body, or both (the default; on import the marker wins). The issue kind (`bug`, `enhancement`, `proposal`, `task`) is stored as a `kind:<kind>` label. Milestones and components cannot be created over the API: push links them by name and warns about any that are missing, so create them in the repository settings first. Full reference: https://yevheniidehtiar.github.io/gitpm/sync-guide/#bitbucket-cloud

## REST 2.0 endpoints used

| Resource | Read | Write |
|---|---|---|
| Repository | `GET /repositories/{ws}/{repo}` | none |
| Issues | `GET …/issues`, `GET …/issues/{id}` | `POST …/issues`, `PUT …/issues/{id}` |
| Issue comments | `GET …/issues/{id}/comments` | `POST …/issues/{id}/comments` |
| Milestones | `GET …/milestones` | none. REST 2.0 documents only `GET`, so milestones must be created in the Bitbucket UI. |
| Components | `GET …/components` | none. REST 2.0 documents only `GET`, so components must be created in the Bitbucket UI. |

The client follows each page's `next` link (page length 50) and refuses links that point to another host so credentials never leave the configured API. It retries `429` (honouring `Retry-After`), `5xx` and network errors with exponential backoff, 3 retries by default.

## Programmatic use

```ts
import type { SyncAdapter } from '@gitpm/core';
import { bitbucketAdapter, createBitbucketClient } from '@gitpm/sync-bitbucket';

const adapter: SyncAdapter = bitbucketAdapter;
const client = createBitbucketClient({ auth: { kind: 'basic', email, token } });
const issues = await client.listIssues('workspace', 'repo', { q: 'state="open"' });
if (!issues.ok) console.error(issues.error.message);
```

Every function returns `Result<T, E>` and never throws.

## Links

Docs: https://yevheniidehtiar.github.io/gitpm/ · Repo: https://github.com/yevheniidehtiar/gitpm · License: MIT
