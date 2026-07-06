---
type: story
id: yHwzPUzLd9a2
title: "feat: add sprint planning view (group stories into time-boxed iterations)"
status: in_progress
priority: medium
assignee: null
labels:
  - enhancement
  - ui
  - cli
  - core
estimate: null
epic_ref:
  id: Jm9BOEIh35z1
github:
  issue_number: 44
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:29d247a8649955790961a1afc0ab5b1b9c522ad447e65107edba46a28e063430
  synced_at: 2026-07-06T17:45:15.667Z
created_at: 2026-04-05T09:49:46.000Z
updated_at: 2026-07-06T17:43:18.994Z
---

## Motivation
HyperAdmin has 179 todos but no sprint structure. Which 10-15 should be worked on this week? GitPM currently has milestones (long-term) but no sprints (short-term).

## Proposed Solution
New entity type: `sprint` (or `iteration`)
```yaml
type: sprint
id: sp-2026-w14
title: Sprint 2026-W14
start_date: 2026-04-01
end_date: 2026-04-07
stories:
  - id: story-1
  - id: story-2
capacity: 40  # story points
```

CLI: `gitpm sprint create`, `gitpm sprint plan` (interactive story picker)
UI: Sprint board view with capacity tracking

## Impact
Bridges the gap between 'we have 179 todos' and 'here's what we're doing this week'.
