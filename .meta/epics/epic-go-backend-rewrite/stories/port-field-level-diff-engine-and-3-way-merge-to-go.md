---
type: story
id: FpBvArXVAKLB
title: Port field-level diff engine and 3-way merge to Go
status: backlog
priority: high
assignee: null
labels:
  - go
  - migration
  - sync
  - diff
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:13.016Z
updated_at: 2026-04-26T20:06:13.016Z
github:
  issue_number: 229
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:ddcfe67f4496c09ac217dcacd135e1808e86a25c0a53f056e93506a535ef42fc
  synced_at: 2026-04-26T20:12:29.712Z
---

**Phase 2 — Sync**

Port `packages/sync-github/src/diff.ts` to `go/internal/sync/github/diff.go`.

- 3-way merge semantics: baseline vs local vs remote
- Field-level comparison with fuzzy equality (null/undefined equivalence, array sorting, whitespace trimming)
- Conflict detection: same field changed both sides with different values
- Conflict resolution strategies: local-wins, remote-wins, ask

**Source reference**: `packages/sync-github/src/diff.ts` (~206 LOC), `conflict.ts` (~59 LOC)

**Acceptance criteria**:
- Diff output matches TypeScript diff for same input triples
- Fuzzy equality handles edge cases (empty strings vs null, unsorted arrays)
