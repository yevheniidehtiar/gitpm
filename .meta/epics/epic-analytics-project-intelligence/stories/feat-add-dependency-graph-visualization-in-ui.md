---
type: story
id: 37zYElFj4-nS
title: "feat: add dependency graph visualization in UI"
status: in_review
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
  last_sync_hash: sha256:85b0de282d51130126d2778214394cf893b0dbc7915c28a45efc0f70705fd7ad
  synced_at: 2026-10-16T21:52:48.755Z
created_at: 2026-04-05T09:49:46.000Z
updated_at: 2026-07-06T17:59:01.091Z
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
