---
type: story
id: 1BJFPEgL5hB3
title: Bitbucket bidirectional sync with field-level diff and conflict resolution
status: backlog
priority: medium
assignee: null
labels:
  - integration
  - story
estimate: 3
epic_ref:
  id: KVvXwhgJEyic
created_at: 2026-10-17T08:22:45.310Z
updated_at: 2026-10-17T08:22:45.310Z
---

`gitpm sync` / `pull` for Bitbucket:
- Field-level 3-way diff against the stored base hash (reuse the shared diff/conflict helpers from core where possible)
- Conflict strategies matching the other adapters (local-wins, remote-wins, ask)
- Resumable sync with checkpoints, as in the Sync Reliability epic
- Reconstruct state from frontmatter when `bitbucket-state.json` is missing
