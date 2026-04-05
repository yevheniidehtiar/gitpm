---
type: story
id: EWHnNnW4rAWN
title: "feat: add stale issue detection and cleanup report"
status: todo
priority: medium
assignee: null
labels:
  - enhancement
  - cli
estimate: null
epic_ref: null
github:
  issue_number: 41
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:5f5aab7038b3fa32d51e4e2f42382efce42e714aaca75f68374b863e45c44029
  synced_at: 2026-04-05T17:24:12.493Z
created_at: 2026-04-05T09:49:44Z
updated_at: 2026-04-05T09:49:44Z
---

## Motivation
HyperAdmin has 179 issues in `todo` status, many created months ago with no updates. In any real project, 30-50% of old todos are stale — superseded, duplicate, or no longer relevant. GitPM should help identify and triage these.

## Proposed Solution
`gitpm audit` command that reports:
- **Stale stories**: `todo` status + no update in 30/60/90 days
- **Orphan stories**: no epic_ref, no milestone context
- **Duplicate candidates**: fuzzy title matching (Levenshtein distance)
- **Empty bodies**: issues with no description (likely low-quality)
- **Zombie epics**: epics with all stories done but epic still `todo`

Output: markdown report or interactive CLI to bulk-close/reassign.

## Why This Matters
This is the #1 pain point in long-running projects. GitHub Issues has no built-in staleness detection. Having it as `gitpm audit` makes it runnable by AI agents in CI.
