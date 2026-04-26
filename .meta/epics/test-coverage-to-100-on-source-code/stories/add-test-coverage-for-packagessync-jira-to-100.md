---
type: story
id: SuODAY7F_oap
title: Add test coverage for packages/sync-jira to 100%
status: in_review
priority: high
assignee: null
labels:
  - testing
  - sync-jira
estimate: null
epic_ref:
  id: xGG0RMogvzyo
created_at: 2026-04-12T19:35:03.249Z
updated_at: 2026-04-19T12:52:40.695Z
github:
  issue_number: 169
  repo: yevheniidehtiar/gitpm
---

## Objective

Bring packages/sync-jira from ~37% to 100% line coverage.

## Current Coverage by File

| File | Lines | Notes |
|---|---|---|
| adapter.ts | 0% | Lines 12-136 — full adapter untested |
| export.ts | 0% | Lines 17-213 — entire export flow untested |
| import.ts | 0% | Lines 26-217 — entire import flow untested |
| sync.ts | 0% | Lines 23-339 — entire sync flow untested |
| client.ts | 72% | Lines 143, 157-170, 182 uncovered |
| state.ts | 84% | Lines 34, 65-71, 111 uncovered |
| diff.ts | 88% | Lines 23-41, 103, 157 uncovered |
| config.ts | 93% | Line 33 uncovered |
| mapper.ts | 96% | Lines 202, 206 uncovered |
| conflict.ts | 100% | Done |
| types.ts | 100% | Done |

## Testing Patterns to Follow

- Tests in src/__tests__/ directory
- vi.stubGlobal('fetch', mockFetch) to mock global fetch API
- No file fixtures — all test data inline as objects
- Helper function: jsonResponse(data, status) for creating mock Response objects
- Factory function: createClient() for JiraClient instances
- beforeEach: vi.stubGlobal('fetch', mockFetch) + mockFetch.mockClear()
- afterEach: vi.restoreAllMocks()

## Existing Tests to Reference

- __tests__/client.test.ts — fetch mocking pattern for JiraClient
- __tests__/mapper.test.ts — pure function testing
- __tests__/state.test.ts — state persistence
- __tests__/diff.test.ts — diff logic with inline data
- __tests__/config.test.ts — config parsing

## Key Challenges

- adapter.ts: wraps SyncAdapter interface — test via dependency injection
- export.ts + import.ts: need careful mock setup for Jira API responses
- sync.ts: complex orchestration — needs mock client + state management

## Acceptance Criteria

- [ ] All source files in packages/sync-jira/src >= 80% line coverage
- [ ] New test files: adapter.test.ts, export.test.ts, import.test.ts, sync.test.ts
- [ ] No regressions in existing tests
