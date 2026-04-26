---
type: story
id: uTLaQ7Pomzpy
title: Add comprehensive Go test suite matching existing TypeScript tests
status: backlog
priority: high
assignee: null
labels:
  - go
  - migration
  - testing
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:10.483Z
updated_at: 2026-04-26T20:06:10.483Z
---

**Phase 1 — Testing**

Create Go test suite in `go/` that validates parity with the TypeScript implementation.

- Unit tests for every public function in schema, parser, writer, resolver, validator, query
- Use `testify` for assertions
- Use `go test -race` to catch concurrency bugs in parallel file operations
- Snapshot tests using `go-snaps` or `cupaloy` for serialization output
- Test fixtures: copy relevant `.test.ts` test cases and fixture files

**Acceptance criteria**:
- Test coverage ≥80% for all `internal/` packages
- All tests pass with `go test -race ./...`
- Parser/writer round-trip tests prove byte-identical output
