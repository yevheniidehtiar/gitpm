---
type: story
id: 4wZ38XRM48fw
title: Add test coverage for packages/sync-gitlab to 100%
status: todo
priority: high
assignee: null
labels:
  - testing
  - sync-gitlab
estimate: null
epic_ref:
  id: xGG0RMogvzyo
created_at: 2026-04-12T19:35:00.664Z
updated_at: 2026-04-12T19:35:00.664Z
---

## Objective

Bring packages/sync-gitlab from ~38% to 100% line coverage.

## Current Coverage by File

| File | Lines | Notes |
|---|---|---|
| adapter.ts | 0% | Lines 12-104 — full adapter untested |
| client.ts | 0% | Lines 6-298 — GitLabClient untested |
| export.ts | 0% | Lines 13-270 — entire export flow untested |
| sync.ts | 0% | Lines 19-442 — entire sync flow untested |
| diff.ts | 18% | Lines 11-39, 70-156 — most diff logic untested |
| config.ts | 50% | Lines 11-17, 35 uncovered |
| linker.ts | 89% | Lines 49, 94-99, 129 uncovered |
| import.ts | 91% | Lines 91-96, 135-139, 259 uncovered |
| state.ts | 91% | Lines 32, 67-69, 118 uncovered |
| mapper.ts | 100% | Done |
| conflict.ts | 100% | Done |
| types.ts | 100% | Done |

## Testing Patterns to Follow

- Tests in src/__tests__/ directory
- Inline fixture objects (no JSON files) — define const baseMilestone: GlMilestone = { ... }
- Inline factory functions: makeStory(), makeMilestone() defined per test file
- No vi.mock() calls — tests use direct object literals and factory functions
- mkdtemp/rm pattern for state file I/O tests
- Result type checking: expect(result.ok).toBe(true); if (result.ok) { ... }

## Existing Tests to Reference

- __tests__/import.test.ts — factory pattern for GitLab import
- __tests__/mapper.test.ts — pure function testing
- __tests__/state.test.ts — mkdtemp + state persistence
- __tests__/diff.test.ts — diff logic testing
- __tests__/linker.test.ts — reference linking tests

## Key Challenges

- client.ts: HTTP client wrapping fetch — mock global fetch (see sync-jira pattern)
- export.ts + sync.ts: complex flows — need mock client + inline fixtures
- diff.ts: currently only 18% — many untested branches

## Acceptance Criteria

- [ ] All source files in packages/sync-gitlab/src >= 80% line coverage
- [ ] New test files: adapter.test.ts, client.test.ts, export.test.ts, sync.test.ts
- [ ] diff.ts coverage raised from 18% to >= 80%
- [ ] No regressions in existing tests
