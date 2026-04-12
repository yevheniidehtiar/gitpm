---
type: story
id: 5khCuRZbTEov
title: Add test coverage to reach 100% on source code
status: todo
priority: high
assignee: null
labels:
  - testing
  - quality
estimate: null
epic_ref: null
created_at: 2026-04-12T18:56:29.341Z
updated_at: 2026-04-12T18:56:29.341Z
---

## Current State (2026-04-12)

- **Overall line coverage:** 58.73% (meaningful source, excl. barrel re-exports, type-only files, UI)
- **Tests:** 579 passing across 56 test files
- **Gap to 100%:** ~1,628 uncovered lines across 3,945 meaningful source lines

## Coverage by Package

| Package | Lines | Key Gaps |
|---|---|---|
| core | ~88% | writer, graph-data, plugin-loader |
| sync-github | ~68% | adapter, client, sync, export |
| sync-gitlab | ~38% | adapter, client, export, sync, diff |
| sync-jira | ~37% | adapter, export, import, sync |
| cli (commands) | ~54% | archive, audit, next, quality, sprint, status |
| cli (utils) | ~6% | adapters, auth, conflict-ui, output |

## Files at 0% Coverage

### sync-github
- adapter.ts, client.ts

### sync-gitlab
- adapter.ts, client.ts, export.ts, sync.ts

### sync-jira
- adapter.ts, export.ts, import.ts, sync.ts

### cli/commands
- archive.ts, audit.ts, next.ts, quality.ts, sprint.ts, status.ts

### cli/utils
- adapters.ts, auth.ts, conflict-ui.ts

## Acceptance Criteria

- [ ] @vitest/coverage-v8 configured in vitest.config.ts
- [ ] bun run test:coverage reports line coverage per package
- [ ] All packages/core source files >= 90% line coverage
- [ ] All packages/sync-github source files >= 80% line coverage
- [ ] All packages/sync-gitlab source files >= 80% line coverage
- [ ] All packages/sync-jira source files >= 80% line coverage
- [ ] All packages/cli source files >= 80% line coverage
- [ ] No source file below 60% line coverage (excl. barrel re-exports and type-only files)
