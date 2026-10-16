---
type: story
id: TDLJNCmsFMbB
title: Implement cross-reference resolver and dependency graph in Go
status: backlog
priority: high
assignee: null
labels:
  - go
  - migration
  - resolver
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:07.119Z
updated_at: 2026-04-26T20:06:07.119Z
github:
  issue_number: 223
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:f1e56a69a8138d19dc522c92d309da46137ec2ad73471c5b1269c0088387aaf9
  synced_at: 2026-04-26T20:12:27.573Z
---

**Phase 1 — Core**

Port `packages/core/src/resolver/` to `go/internal/resolver/`.

- Build lookup maps: story→epic, epic→milestone, roadmap→milestones, prd→epics
- Resolve `EntityRef` fields to actual entity pointers
- Build adjacency-list dependency graph
- Implement topological sort (Kahn's algorithm or DFS)
- Implement cycle detection (DFS with coloring)
- Return `ResolvedTree` with populated cross-references

**Source reference**: `packages/core/src/resolver/` (~172 LOC)

**Acceptance criteria**:
- All reference chains resolve correctly (story→epic→milestone→roadmap)
- Broken references are reported as errors, not panics
- Cycle detection catches circular dependencies
