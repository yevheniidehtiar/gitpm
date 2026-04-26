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
