---
type: story
id: aKs9FUGEAX-F
title: Implement Bitbucket → .meta import flow
status: backlog
priority: high
assignee: null
labels:
  - integration
  - story
estimate: 3
epic_ref:
  id: KVvXwhgJEyic
created_at: 2026-10-17T08:22:44.199Z
updated_at: 2026-10-17T08:22:44.199Z
github:
  issue_number: 286
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:3a37dd7a4198655b08901b2f7101d4022d26bef8abc13cdf094a710bae130d27
  synced_at: 2026-10-17T11:20:24.306Z
---

`gitpm import --source bitbucket`:
- Fetch issues and milestones and write stories, epics and milestones through the core writer
- Rebuild epic → story linkage from the component or the body marker
- Write `.meta/sync/bitbucket-state.json` with content hashes
- Idempotent: re-running import makes no changes
- Fixture-based tests, including large paginated repositories
