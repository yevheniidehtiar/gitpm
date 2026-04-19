---
type: story
id: FPiV0EvcXREt
title: Add test coverage for packages/core to 100%
status: in_review
priority: high
assignee: null
labels:
  - testing
  - core
estimate: null
epic_ref:
  id: xGG0RMogvzyo
created_at: 2026-04-12T19:34:55.144Z
updated_at: 2026-04-19T12:43:41.674Z
---

## Objective

Bring packages/core from ~88% to 100% line coverage.

## Current Coverage by File

| File | Lines | Notes |
|---|---|---|
| analytics/graph-data.ts | 64% | Lines 57-78 uncovered |
| writer/create-entity.ts | 67% | Lines 146, 170, 206-245 uncovered |
| writer/set-fields.ts | 74% | Lines 159, 172, 205-245 uncovered |
| writer/write-tree.ts | 75% | Lines 22, 28 uncovered |
| resolver/resolve.ts | 83% | Lines 42, 86, 103, 116-128 uncovered |
| parser/parse-tree.ts | 85% | Lines 55, 60, 94-95, 101 uncovered |
| plugin-loader.ts | 88% | Lines 190, 200, 267, 344 uncovered |
| archiver/index.ts | 92% | Lines 63-64, 71-72, 131 uncovered |
| parser/parse-file.ts | 89% | Lines 65, 72, 84, 114, 129 uncovered |
| writer/write-file.ts | 93% | Line 32 uncovered |
| config.ts | 100% | Done |
| adapter.ts | 100% | Done |

Barrel re-export files (index.ts) and type-only files (types.ts) can be excluded from coverage — they have 0% but contain no logic.

## Testing Patterns to Follow

- Test files colocated as *.test.ts next to source files
- Factory functions: makeStory(), makeEpic(), makeMilestone() with Partial overrides
- Fixture directories in __fixtures__/ for real file trees
- No module mocking; tests use real objects with factory data
- Result type checking: expect(result.ok).toBe(true)

## Existing Tests to Reference

- writer/create-entity.test.ts, writer/set-fields.test.ts, writer/writer.test.ts
- parser/parser.test.ts
- resolver/resolver.test.ts
- analytics/graph-data.test.ts, analytics/audit.test.ts
- plugin-loader.test.ts, archiver/archiver.test.ts

## Acceptance Criteria

- [ ] All source files in packages/core/src >= 90% line coverage
- [ ] No regressions in existing 579 tests
- [ ] Tests follow colocated *.test.ts pattern with factory functions
