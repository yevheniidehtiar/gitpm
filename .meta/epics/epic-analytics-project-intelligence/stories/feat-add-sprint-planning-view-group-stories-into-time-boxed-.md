---
type: story
id: yHwzPUzLd9a2
title: "feat: add sprint planning view (group stories into time-boxed iterations)"
status: done
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
  last_sync_hash: sha256:b9d800fc3921defa5fed8817d4a8f5263b23a48451b6bf744fe463fec778f6c0
  synced_at: 2026-10-17T11:20:21.592Z
created_at: 2026-04-05T09:49:46.000Z
updated_at: 2026-10-16T22:21:22.186Z
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
