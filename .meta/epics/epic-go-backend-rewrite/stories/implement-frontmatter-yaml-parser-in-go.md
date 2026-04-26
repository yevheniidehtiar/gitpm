---
type: story
id: FRhI2gSRlFS4
title: Implement frontmatter + YAML parser in Go
status: backlog
priority: high
assignee: null
labels:
  - go
  - migration
  - parser
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:05.418Z
updated_at: 2026-04-26T20:06:05.418Z
---

**Phase 1 — Core**

Port `packages/core/src/parser/` to `go/internal/parser/`.

- Use `adrg/frontmatter` to extract YAML frontmatter from markdown files
- Use `gopkg.in/yaml.v3` to parse pure YAML files (roadmaps)
- Walk `.meta/` directory tree recursively, detecting entity type from `type` field
- Parse into typed Go structs using schema package
- Collect parse errors without aborting (match TS behavior)
- Use goroutines + `sync.WaitGroup` for parallel file reads

**Source reference**: `packages/core/src/parser/index.ts` (~253 LOC)

**Acceptance criteria**:
- Parses the project's own `.meta/` directory identically to TypeScript parser
- Handles malformed frontmatter gracefully (returns ParseError, not panic)
- Parallel reads show measurable speedup over sequential
