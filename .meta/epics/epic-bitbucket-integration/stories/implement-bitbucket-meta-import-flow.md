---
type: story
id: aKs9FUGEAX-F
title: Implement Bitbucket → .meta import flow
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
  issue_number: 286
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:615f12b010dbd33da3e03bc1e6d62eca412a0d9a385e34b6c0acd11f6dc6c1e2
  synced_at: 2026-10-19T23:27:54.856Z
created_at: 2026-10-17T08:22:44.199Z
updated_at: 2026-10-18T20:47:38.778Z
---

`gitpm import --source bitbucket`:
- Fetch issues and milestones and write stories, epics and milestones through the core writer
- Rebuild epic → story linkage from the component or the body marker
- Write `.meta/sync/bitbucket-state.json` with content hashes
- Idempotent: re-running import makes no changes
- Fixture-based tests, including large paginated repositories
