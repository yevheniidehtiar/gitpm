---
type: story
id: t-5Zer-z2bLY
title: Port Zod schemas to Go structs with validation tags
status: backlog
priority: high
assignee: null
labels:
  - go
  - migration
  - schema
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:05:48.251Z
updated_at: 2026-04-26T20:05:48.251Z
---

**Phase 1 — Foundation**

Port all Zod schemas from `packages/core/src/schemas/` to Go structs in `go/internal/schema/`.

- Map `Status`, `Priority` enums to Go `string` constants
- Map `EntityRef`, `GitHubSync`, `GitLabSync`, `JiraSync` to Go structs with YAML/JSON tags
- Map `Story`, `Epic`, `Milestone`, `Roadmap`, `Prd` frontmatter + entity types
- Implement the `Entity` interface for polymorphic operations
- Add `go-playground/validator` tags for required fields and enum constraints
- Add `Result[T]` generic type matching the TS `Result<T, E>` pattern

**Source reference**: `packages/core/src/schemas/common.ts`, `story.ts`, `epic.ts`, `milestone.ts`, `roadmap.ts`, `prd.ts`

**Acceptance criteria**:
- All entity types deserialize from YAML frontmatter correctly
- Round-trip: parse → serialize → parse produces identical output
- Validation rejects invalid status/priority values
