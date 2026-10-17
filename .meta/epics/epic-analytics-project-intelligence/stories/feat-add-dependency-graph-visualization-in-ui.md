---
type: story
id: 37zYElFj4-nS
title: "feat: add dependency graph visualization in UI"
status: done
priority: medium
assignee: null
labels:
  - enhancement
  - ui
estimate: null
epic_ref:
  id: Jm9BOEIh35z1
github:
  issue_number: 45
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:f4446f6c04b13cfc66f6945ec9c700dc998fc45fb120205eff98d7cee7a2d370
  synced_at: 2026-10-17T11:20:20.464Z
created_at: 2026-04-05T09:49:46.000Z
updated_at: 2026-10-16T22:21:21.821Z
---

## Motivation
HyperAdmin's epics have explicit dependency chains (e.g. adapter query perf → load testing → scalability validation). The resolver already builds a dependency graph, but there's no way to visualize it.

## Proposed Solution
New UI route `/#/graph`:
- Render entity dependency graph using `d3-force` or `elkjs`
- Nodes = entities (color by type/status)
- Edges = epic_ref, milestone_ref, and body `#N` references
- Click to navigate to entity
- Highlight critical path (longest chain of unfinished dependencies)

## Impact
Answers: 'What's blocking what?' — the most valuable question in project planning.
