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
github:
  issue_number: 233
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:8afc465abc117d220c1e852b1e1de1d7f7568cc9ad13c2cd3bf198b785e4a549
  synced_at: 2026-04-26T20:12:31.059Z
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
