# @gitpm/sync-bitbucket

Bitbucket Cloud sync adapter for [gitpm](https://github.com/yevheniidehtiar/gitpm).

> **Work in progress.** This release ships only the REST API client. The import, export and sync flows and the CLI wiring are tracked in the Bitbucket Integration epic.

## Scope

Bitbucket **Cloud** only. Bitbucket Data Center/Server has no issue tracker and delegates to Jira, so use `@gitpm/sync-jira` there. The repository must have its issue tracker enabled.

## Authentication

| Token | Header | Use when |
|---|---|---|
| Atlassian API token + account email | `Basic email:token` | Personal use |
| Workspace or repository access token | `Bearer token` | CI and bots |

App passwords are deprecated by Atlassian and are not supported.

```ts
import { createBitbucketClient } from '@gitpm/sync-bitbucket';

const client = createBitbucketClient({
  auth: { kind: 'basic', email: 'you@example.com', token: process.env.BITBUCKET_TOKEN ?? '' },
});
const issues = await client.listIssues('workspace', 'repo', { q: 'state="open"' });
if (!issues.ok) console.error(issues.error.message);
```

Every client method returns `Result<T, BitbucketError>` and never throws.

## REST 2.0 endpoints used

| Resource | Read | Write |
|---|---|---|
| Repository | `GET /repositories/{ws}/{repo}` | — |
| Issues | `GET …/issues`, `GET …/issues/{id}` | `POST …/issues`, `PUT …/issues/{id}` |
| Issue comments | `GET …/issues/{id}/comments` | `POST …/issues/{id}/comments` |
| Milestones | `GET …/milestones` | **None.** REST 2.0 documents only `GET`, so milestones must be created in the Bitbucket UI. |
| Components | `GET …/components` | **None.** REST 2.0 documents only `GET`, so components must be created in the Bitbucket UI. |

The client follows each page's `next` link (page length 50). It refuses links that point to another host so credentials never leave the configured API. It retries `429` (honouring `Retry-After`), `5xx` and network errors with exponential backoff, 3 retries by default.
