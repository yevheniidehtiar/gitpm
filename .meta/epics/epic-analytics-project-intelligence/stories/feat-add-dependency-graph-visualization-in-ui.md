---
type: story
id: 37zYElFj4-nS
title: "feat: add dependency graph visualization in UI"
status: todo
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
  last_sync_hash: sha256:5504c7b309f817906538fa5e6d5319b801a62d6fdd15ca3d9c2ca25aff0d6769
  synced_at: 2026-04-05T17:24:12.493Z
created_at: 2026-04-05T09:49:46Z
updated_at: 2026-04-05T09:49:46Z
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
