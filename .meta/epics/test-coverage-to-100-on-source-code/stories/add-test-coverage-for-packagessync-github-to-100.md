---
type: story
id: gZqoT27kxWyx
title: Add test coverage for packages/sync-github to 100%
status: todo
priority: high
assignee: null
labels:
  - testing
  - sync-github
estimate: null
epic_ref:
  id: xGG0RMogvzyo
created_at: 2026-04-12T19:34:57.917Z
updated_at: 2026-04-12T19:34:57.917Z
---

## Objective

Bring packages/sync-github from ~68% to 100% line coverage.

## Current Coverage by File

| File | Lines | Notes |
|---|---|---|
| adapter.ts | 0% | Lines 12-100 — full adapter class untested |
| client.ts | 0% | Lines 7-254 — GitHubClient wrapper untested |
| sync.ts | 37% | Lines 160-530, 550-581 — bulk of sync logic untested |
| config.ts | 50% | Lines 15-21, 39 uncovered |
| export.ts | 67% | Lines 142, 248-270, 288 uncovered |
| checkpoint.ts | 87% | Lines 39, 54, 79, 92 uncovered |
| diff.ts | 90% | Lines 24-42, 113 uncovered |
| import.ts | 98% | Lines 122, 245 uncovered |
| linker.ts | 98% | Lines 77, 159 uncovered |
| state.ts | 94% | Lines 139, 179-181, 230 uncovered |
| mapper.ts | 100% | Done |
| conflict.ts | 100% | Done |
| types.ts | 100% | Done |

## Testing Patterns to Follow

- Tests in src/__tests__/ directory
- vi.mock() for module-level mocking (e.g., mock GitHubClient)
- Fixture files in __fixtures__/ as JSON (github-issues.json, github-milestones.json)
- vi.fn() for fine-grained method mocks (mockCreateIssue, mockUpdateIssue)
- beforeEach/afterEach with mkdtemp/rm for temporary state files
- afterEach: vi.restoreAllMocks()

## Existing Tests to Reference

- __tests__/export.test.ts — mock client pattern for export
- __tests__/import.test.ts — fixture-based import testing
- __tests__/sync.test.ts — temp dir + mock client for sync
- __tests__/mapper.test.ts — pure function testing

## Key Challenges

- adapter.ts: wraps SyncAdapter interface — test via dependency injection
- client.ts: wraps Octokit — mock fetch or Octokit methods
- sync.ts: complex orchestration — needs careful mock setup for bidirectional sync

## Acceptance Criteria

- [ ] All source files in packages/sync-github/src >= 80% line coverage
- [ ] adapter.ts and client.ts have dedicated test files
- [ ] sync.ts covers happy path + error paths for bidirectional sync
- [ ] No regressions in existing tests
