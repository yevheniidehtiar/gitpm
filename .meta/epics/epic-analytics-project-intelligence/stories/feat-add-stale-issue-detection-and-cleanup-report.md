---
type: story
id: EWHnNnW4rAWN
title: "feat: add stale issue detection and cleanup report"
status: in_progress
priority: medium
assignee: null
labels:
  - enhancement
  - cli
estimate: null
epic_ref:
  id: Jm9BOEIh35z1
github:
  issue_number: 41
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:00dc53aadf02ce764a48ade296d6f5a5d9b1ef690f9934aecc9fd681aa6bcac8
  synced_at: 2026-07-06T17:45:16.222Z
created_at: 2026-04-05T09:49:44.000Z
updated_at: 2026-07-06T17:43:18.882Z
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
