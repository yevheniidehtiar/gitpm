---
type: story
id: txVRquDyOVNL
title: Port sync state management and content hashing to Go
status: backlog
priority: medium
assignee: null
labels:
  - go
  - migration
  - sync
  - state
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:13.852Z
updated_at: 2026-04-26T20:06:13.852Z
---

**Phase 2 — Sync**

Port `packages/sync-github/src/state.ts` to `go/internal/sync/github/state.go`.

- Sync state persistence in `.meta/sync/github-state.json`
- Content hash computation: normalize fields → sort keys → SHA256 of JSON
- State reconstruction from entity `github:` frontmatter if JSON missing
- Checkpoint mechanism for resumable sync on failure

**Source reference**: `packages/sync-github/src/state.ts` (~242 LOC), `sync.ts` checkpoint logic

**Acceptance criteria**:
- Content hashes are identical to TypeScript implementation for same entities
- Checkpoint save/load preserves sync progress correctly
