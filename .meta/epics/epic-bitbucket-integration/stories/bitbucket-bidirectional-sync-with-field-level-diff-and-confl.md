---
type: story
id: 1BJFPEgL5hB3
title: Bitbucket bidirectional sync with field-level diff and conflict resolution
status: in_review
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
  last_sync_hash: sha256:37af1e2424feb64604939995daab242a8f3fdbd96a97a051ae5ac308f86b53a8
  synced_at: 2026-10-17T11:20:22.764Z
created_at: 2026-10-17T08:22:45.310Z
updated_at: 2026-10-18T20:42:41.493Z
---

`gitpm sync` / `pull` for Bitbucket:
- Field-level 3-way diff against the stored base hash (reuse the shared diff/conflict helpers from core where possible)
- Conflict strategies matching the other adapters (local-wins, remote-wins, ask)
- Resumable sync with checkpoints, as in the Sync Reliability epic
- Reconstruct state from frontmatter when `bitbucket-state.json` is missing
