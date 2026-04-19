---
type: story
id: U6BKvIRC58Dp
title: Add test coverage for packages/cli to 100%
status: in_review
priority: high
assignee: null
labels:
  - testing
  - cli
estimate: null
epic_ref:
  id: xGG0RMogvzyo
created_at: 2026-04-12T19:35:05.843Z
updated_at: 2026-04-19T12:45:55.337Z
---

## Objective

Bring packages/cli from ~54% (commands) and ~6% (utils) to 100% line coverage.

## Current Coverage — Commands

| File | Lines | Notes |
|---|---|---|
| archive.ts | 0% | Lines 17-101 — entire command untested |
| audit.ts | 0% | Lines 16-95 — entire command untested |
| next.ts | 0% | Lines 9-85 — entire command untested |
| quality.ts | 0% | Lines 16-133 — entire command untested |
| sprint.ts | 0% | Lines 18-176 — entire command untested |
| status.ts | 0% | Lines 13-97 — entire command untested |
| show.ts | 70% | Lines 145, 172-192, 209 uncovered |
| create.ts | 70% | Lines 117-118, 142-143 uncovered |
| import.ts | 86% | Lines 60, 67, 108-109 uncovered |
| pull.ts | 89% | Lines 26-29, 48-49 uncovered |
| push.ts | 85% | Lines 37-39, 55-57, 86-87 uncovered |
| sync.ts | 80% | Lines 152, 180, 191-198 uncovered |
| init.ts | 94% | Lines 17-19 uncovered |
| commit.ts | 100% | Done |
| move.ts | 100% | Done |
| set.ts | 100% | Done |
| validate.ts | 100% | Done |
| query.ts | 97% | Line 65 uncovered |

## Current Coverage — Utils

| File | Lines | Notes |
|---|---|---|
| adapters.ts | 0% | Lines 25-76 — adapter factory untested |
| auth.ts | 0% | Lines 10-25 — auth helpers untested |
| conflict-ui.ts | 0% | Lines 11-44 — conflict UI untested |
| output.ts | 20% | Lines 16-30 — most output utils untested |
| config.ts | 100% | Done |

## Testing Patterns to Follow

- Tests in src/__tests__/ directory
- vi.mock() for module mocking (@gitpm/core, @inquirer/prompts, node:child_process)
- vi.fn() for mock functions: mockExecSync, mockScaffoldMeta, etc.
- Temporary directories: mkdtemp/rm pattern for file system isolation
- vi.spyOn(console, 'log'), vi.spyOn(process, 'exit') for CLI output/behavior
- async function run(...args) helper to invoke commands programmatically
- seedMetaDir() helper to create test directory structure
- beforeEach: mkdtemp(), vi.resetModules(), vi.resetAllMocks(), vi.spyOn()
- afterEach: vi.restoreAllMocks(), rm(tmpDir, { recursive: true, force: true })
- process.exit mocked to throw: mockImplementation(() => { throw new Error('process.exit') })

## Existing Tests to Reference

- __tests__/create.test.ts — command with subcommands
- __tests__/query.test.ts — complex option handling
- __tests__/show.test.ts — output formatting tests
- __tests__/init.test.ts — file system setup tests
- __tests__/push.test.ts — sync command with mock client

## Acceptance Criteria

- [ ] All command files in packages/cli/src/commands >= 80% line coverage
- [ ] All util files in packages/cli/src/utils >= 80% line coverage
- [ ] New test files for: archive, audit, next, quality, sprint, status commands
- [ ] New test files for: adapters.ts, auth.ts, conflict-ui.ts utils
- [ ] No regressions in existing tests
