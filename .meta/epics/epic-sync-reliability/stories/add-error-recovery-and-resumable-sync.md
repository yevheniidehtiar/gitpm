---
type: story
id: HE_jzoks9ky_
title: Add error recovery and resumable sync
status: in_progress
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
  last_sync_hash: sha256:2ba62766f1598b6992146f51a59a62de8fdcc8a9ecb37211992f70c0461383ca
  synced_at: 2026-04-26T20:12:34.377Z
created_at: 2026-04-04T20:08:23.000Z
updated_at: 2026-04-04T20:08:24.000Z
---

If `gitpm sync` fails mid-way (API error at issue #147 of 200), it should:
1. Save progress to `.meta/.gitpm/sync-checkpoint.json`
2. On next run, detect checkpoint and offer to resume
3. Skip already-synced entities
4. Provide clear error message about what failed and why

Critical for large repos where API failures are likely.
