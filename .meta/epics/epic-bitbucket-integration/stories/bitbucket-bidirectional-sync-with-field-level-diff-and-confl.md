---
type: story
id: 1BJFPEgL5hB3
title: Bitbucket bidirectional sync with field-level diff and conflict resolution
status: done
priority: medium
assignee: null
labels:
  - integration
  - story
estimate: 3
epic_ref:
  id: KVvXwhgJEyic
github:
  issue_number: 283
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:0ab60cdfc0c276f826d3fdc9dbf89591af9e1aebb3e5fa500cf03c5ec9444c74
  synced_at: 2026-10-19T23:27:53.567Z
created_at: 2026-10-17T08:22:45.310Z
updated_at: 2026-10-18T20:47:38.453Z
---

`gitpm sync` / `pull` for Bitbucket:
- Field-level 3-way diff against the stored base hash (reuse the shared diff/conflict helpers from core where possible)
- Conflict strategies matching the other adapters (local-wins, remote-wins, ask)
- Resumable sync with checkpoints, as in the Sync Reliability epic
- Reconstruct state from frontmatter when `bitbucket-state.json` is missing
