---
type: story
id: ZYZuAg-b_4Tj
title: Scaffold @gitpm/sync-bitbucket package and REST API client
status: in_review
priority: high
assignee: null
labels:
  - integration
  - story
estimate: 3
epic_ref:
  id: KVvXwhgJEyic
created_at: 2026-10-17T08:22:43.489Z
updated_at: 2026-10-17T08:36:03.044Z
---

Create the `@gitpm/sync-bitbucket` package (tsup build, vitest, release-please component) with a typed Bitbucket Cloud REST 2.0 client:
- Auth: Atlassian API token (email + token, Basic) and workspace/repository access token (Bearer). No app passwords.
- Endpoints: repository, issues (list/get/create/update), milestones, components, issue comments
- Pagination via the `next` link; retry on 429/5xx with backoff
- Verify which of the milestones/components endpoints are writable and record the result in the package README
- Every function returns `Result<T, E>` and never throws
- Unit tests against recorded fixtures in `packages/core/src/__fixtures__/`
