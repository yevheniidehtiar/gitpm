---
type: story
id: iKYC3tOvX51T
title: Implement GitLab REST API client
status: todo
priority: medium
assignee: null
labels:
  - integration
  - story
estimate: null
epic_ref:
  id: 7d7n5ZMxSPon
github:
  issue_number: 23
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:7f12c987782a56daae594edf9c0a64956912bfc590266fa26b20bd638fe94aa2
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:08:06Z
updated_at: 2026-04-04T20:08:06Z
---

Create `@gitpm/sync-gitlab` package with a GitLab API client:
- Authentication via personal access token
- Support GitLab.com and self-hosted (configurable base URL)
- List projects, issues, milestones, epics (premium)
- Create/update issues and milestones
- Handle pagination (keyset + offset) and rate limiting

Part of #12
