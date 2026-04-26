---
type: story
id: 3s7ljxxGGxnC
title: "feat: improve epic-story linkage during import (sub-issues, milestones, labels)"
status: done
priority: high
assignee: null
labels:
  - enhancement
  - sync
estimate: null
epic_ref:
  id: 9_EjGg7jTN0Y
github:
  issue_number: 35
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:897d1deff9bab7be587f22a9401000eaa57612415d44a590ad3063476ff1f6a5
  synced_at: 2026-04-12T11:18:11.225Z
created_at: 2026-04-05T09:48:50.000Z
updated_at: 2026-04-12T10:52:35.894Z
---

## Problem
Import only links stories to epics via `#N` references in issue body text. In hyper-admin (362 entities), 65% of stories (195/301) ended up as standalone — orphaned from any epic.

## Root Cause
The import misses several GitHub linking patterns:
1. **GitHub Sub-Issues API** — not queried at all
2. **Milestone-based grouping** — stories sharing a milestone with an epic aren't linked
3. **Label-based grouping** — e.g. all issues labeled `area:adapters` could belong to adapter epic
4. **Project board columns** — not imported (GraphQL API needed)

## Proposed Solution
Add fallback heuristics in order:
1. Check GitHub Sub-Issues API (REST or GraphQL)
2. If story has same milestone as exactly one epic, link it
3. If story shares labels with exactly one epic, link it
4. Add a `--link-strategy` CLI flag: `body-refs` (current), `sub-issues`, `milestone`, `labels`, `all`

## Impact
A flat list of 195 orphan stories is unmanageable. Epic grouping is the primary organizational tool.
