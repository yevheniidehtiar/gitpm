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
github:
  issue_number: 226
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:13a79c00aca08fb14f0090afe84b8444943d71d1d0c999688ea8a96ba3ea6b02
  synced_at: 2026-04-26T20:12:28.686Z
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
