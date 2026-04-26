---
type: story
id: Z-lwOdlJ1UUZ
title: Implement entity writer and file serialization in Go
status: backlog
priority: high
assignee: null
labels:
  - go
  - migration
  - writer
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:06.278Z
updated_at: 2026-04-26T20:06:06.278Z
---

**Phase 1 — Core**

Port `packages/core/src/writer/` to `go/internal/writer/`.

- Serialize entities back to YAML frontmatter + markdown body format
- Implement `ScaffoldMeta()` to create initial `.meta/` directory structure
- Implement `ToSlug()` for filesystem-safe naming with collision handling
- Implement field assignment parsing for `set` command (dotted paths like `epic_ref.id=x`)
- Implement `MoveStory()` for directory reorganization
- Implement `CreateStory/Epic/Milestone()` with nanoid-style ID generation

**Source reference**: `packages/core/src/writer/` (~662 LOC)

**Acceptance criteria**:
- Written files are byte-identical to TypeScript writer output (same YAML formatting)
- Slug generation handles Unicode, special characters, collisions
- Field assignment parsing supports nested paths
