---
type: story
id: H7g4yM0FZIGs
title: Implement tree-wide validator in Go
status: backlog
priority: medium
assignee: null
labels:
  - go
  - migration
  - validator
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:08.002Z
updated_at: 2026-04-26T20:06:08.002Z
github:
  issue_number: 227
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:400db682016149ca6dcf4151d90d903fe9617d3fc275e317a872bbb85ef30159
  synced_at: 2026-04-26T20:12:29.052Z
---

**Phase 1 — Core**

Port `packages/core/src/validator/` to `go/internal/validator/`.

- Duplicate entity ID detection
- Circular dependency detection (via resolver's graph)
- Status consistency checks (epic "done" with active stories)
- Unresolved reference warnings

**Source reference**: `packages/core/src/validator/` (~123 LOC)

**Acceptance criteria**:
- Catches all validation issues the TypeScript validator catches
- Returns structured ValidationResult with errors and warnings
