---
type: story
id: ZYZuAg-b_4Tj
title: Scaffold @gitpm/sync-bitbucket package and REST API client
status: done
priority: high
assignee: null
labels:
  - integration
  - story
estimate: 3
epic_ref:
  id: KVvXwhgJEyic
github:
  issue_number: 288
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:a6002e99767a423557f5353ea51cd878463091fd6b3afd1d21814a8de0f81ec0
  synced_at: 2026-10-17T20:04:11.868Z
created_at: 2026-10-17T08:22:43.489Z
updated_at: 2026-10-17T12:39:18.887Z
---

Create the `@gitpm/sync-bitbucket` package (tsup build, vitest, release-please component) with a typed Bitbucket Cloud REST 2.0 client:
- Auth: Atlassian API token (email + token, Basic) and workspace/repository access token (Bearer). No app passwords.
- Endpoints: repository, issues (list/get/create/update), milestones, components, issue comments
- Pagination via the `next` link; retry on 429/5xx with backoff
- Verify which of the milestones/components endpoints are writable and record the result in the package README
- Every function returns `Result<T, E>` and never throws
- Unit tests against recorded fixtures in `packages/core/src/__fixtures__/`
