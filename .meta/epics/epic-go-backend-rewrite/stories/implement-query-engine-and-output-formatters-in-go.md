---
type: story
id: UN4-QCSTfnmN
title: Implement query engine and output formatters in Go
status: backlog
priority: medium
assignee: null
labels:
  - go
  - migration
  - query
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:08.815Z
updated_at: 2026-04-26T20:06:08.815Z
---

**Phase 1 — Core**

Port `packages/core/src/query/` to `go/internal/query/`.

- Declarative filtering by type, status, priority, labels, epic, assignee, text
- Output formatters: table (aligned columns), JSON, CSV
- Text search across title and body fields

**Source reference**: `packages/core/src/query/` (~187 LOC)

**Acceptance criteria**:
- Filter combinations match TypeScript query output
- Table format is human-readable with aligned columns
- JSON output matches the schema for UI consumption
