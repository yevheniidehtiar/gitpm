---
type: story
id: uSwxALv1JDgu
title: "feat: reconstruct sync state from entity frontmatter on startup"
status: in_progress
priority: high
assignee: null
labels:
  - enhancement
  - sync
estimate: null
epic_ref:
  id: 9_EjGg7jTN0Y
github:
  issue_number: 36
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:d5ff9ad4fa373a6406bdfaa6c5bddb3226f18bda674495fe2ab9cd1182bccaef
  synced_at: 2026-04-05T17:24:12.493Z
created_at: 2026-04-05T09:48:50Z
updated_at: 2026-04-05T09:48:50Z
---

## Problem
When `github-state.json` is gitignored or missing (e.g. fresh clone), the Sync Dashboard shows 'Not Synced / Never' for every entity — even though each entity has `github:` frontmatter with issue numbers and sync hashes.

## Expected
If `github-state.json` is missing but entities have `github:` metadata, reconstruct the sync state automatically.

## Proposed Solution
In `loadState()`, if the JSON file doesn't exist:
1. Walk the .meta tree
2. Extract `github:` blocks from all entities
3. Build initial state from `last_sync_hash` and `synced_at` fields
4. Save reconstructed state

This makes sync state a cache, not a source of truth.
