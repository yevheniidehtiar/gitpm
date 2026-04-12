---
type: story
id: HE_jzoks9ky_
title: Add error recovery and resumable sync
status: done
priority: high
assignee: null
labels:
  - enhancement
  - story
estimate: null
epic_ref:
  id: 9_EjGg7jTN0Y
github:
  issue_number: 29
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:6feb363dacfaaf9548743f5eac3fef65b07715f90cd3b5d4767c8107cbf442db
  synced_at: 2026-04-12T11:18:10.654Z
created_at: 2026-04-04T20:08:23.000Z
updated_at: 2026-04-12T10:52:33.577Z
---

If `gitpm sync` fails mid-way (API error at issue #147 of 200), it should:
1. Save progress to `.meta/.gitpm/sync-checkpoint.json`
2. On next run, detect checkpoint and offer to resume
3. Skip already-synced entities
4. Provide clear error message about what failed and why

Critical for large repos where API failures are likely.
