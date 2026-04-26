---
type: epic
id: xGG0RMogvzyo
title: Test Coverage to 100% on Source Code
status: in_progress
priority: high
owner: null
labels:
  - testing
  - quality
milestone_ref: null
created_at: 2026-04-12T19:33:41.549Z
updated_at: 2026-04-12T19:33:41.549Z
github:
  issue_number: 164
  repo: yevheniidehtiar/gitpm
---

## Goal

Bring all non-UI source code to 100% line coverage, from the current baseline of ~59% meaningful lines (48.98% including barrel re-exports and type-only files).

## Baseline (2026-04-12)

- **579 tests** passing across 56 test files
- **Lines:** 58.73% (meaningful source)
- **Branches:** 51.53%
- **Functions:** 68.31%
- **Gap:** ~1,628 uncovered lines across 3,945 meaningful source lines

## Strategy

Split by package — each story is independently parallelizable:

1. **core** (~88% to 100%) — small gap, mainly writer + graph-data
2. **sync-github** (~68% to 100%) — adapter, client, sync, export
3. **sync-gitlab** (~38% to 100%) — adapter, client, export, sync, diff
4. **sync-jira** (~37% to 100%) — adapter, export, import, sync
5. **cli** (~54% to 100%) — 6 commands + 3 utils at 0%

Each story includes per-file coverage data, existing test patterns to follow, and acceptance criteria.

## Verification

Run bun run test:coverage and confirm no meaningful source file is below 80%.
