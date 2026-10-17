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
---

`gitpm import --source bitbucket`:
- Fetch issues and milestones and write stories, epics and milestones through the core writer
- Rebuild epic → story linkage from the component or the body marker
- Write `.meta/sync/bitbucket-state.json` with content hashes
- Idempotent: re-running import makes no changes
- Fixture-based tests, including large paginated repositories
