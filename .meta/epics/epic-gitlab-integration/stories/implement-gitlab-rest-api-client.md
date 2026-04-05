---
type: story
id: iKYC3tOvX51T
title: Implement GitLab REST API client
status: done
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
  last_sync_hash: sha256:a15ef2a7bb416114196f4c06f8aa847bfd9f3843befcc1d5319d56f38ab8ed21
  synced_at: 2026-04-05T23:44:23.889Z
created_at: 2026-04-04T20:08:06.000Z
updated_at: 2026-04-04T20:08:06.000Z
---

Create `@gitpm/sync-gitlab` package with a GitLab API client:
- Authentication via personal access token
- Support GitLab.com and self-hosted (configurable base URL)
- List projects, issues, milestones, epics (premium)
- Create/update issues and milestones
- Handle pagination (keyset + offset) and rate limiting

Part of #12
