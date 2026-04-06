---
type: story
id: HE_jzoks9ky_
title: Add error recovery and resumable sync
status: todo
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
  last_sync_hash: sha256:b6017c599dfdc6b36e4fe0ff752caa0a918bd2f3623cfb4ae7650ad4824fca10
  synced_at: 2026-04-06T13:34:02.243Z
created_at: 2026-04-04T20:08:23.000Z
updated_at: 2026-04-04T20:08:24.000Z
---

If `gitpm sync` fails mid-way (API error at issue #147 of 200), it should:
1. Save progress to `.meta/.gitpm/sync-checkpoint.json`
2. On next run, detect checkpoint and offer to resume
3. Skip already-synced entities
4. Provide clear error message about what failed and why

Critical for large repos where API failures are likely.
