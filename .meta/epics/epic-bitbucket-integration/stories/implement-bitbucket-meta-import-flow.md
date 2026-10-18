---
type: story
id: aKs9FUGEAX-F
title: Implement Bitbucket → .meta import flow
status: in_review
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
  last_sync_hash: sha256:ecb522ef055560678d926705b91df51cba8dda21b9e877ed457a8130cf3b7680
  synced_at: 2026-10-18T19:53:03.667Z
created_at: 2026-10-17T08:22:44.199Z
updated_at: 2026-10-18T19:49:09.780Z
---

`gitpm import --source bitbucket`:
- Fetch issues and milestones and write stories, epics and milestones through the core writer
- Rebuild epic → story linkage from the component or the body marker
- Write `.meta/sync/bitbucket-state.json` with content hashes
- Idempotent: re-running import makes no changes
- Fixture-based tests, including large paginated repositories
