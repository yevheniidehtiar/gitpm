---
type: story
id: XDbbOigUWenB
title: "feat: add progress tracking (completion %) to milestones and epics"
status: in_progress
priority: medium
assignee: null
labels:
  - enhancement
  - ui
  - core
estimate: null
epic_ref:
  id: Jm9BOEIh35z1
github:
  issue_number: 42
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:4da680d6e189a55b49fb31b71fc7094ee494df47ba17721f11b3c3a3759e380f
  synced_at: 2026-07-06T17:45:15.136Z
created_at: 2026-04-05T09:49:45.000Z
updated_at: 2026-07-06T17:43:18.769Z
---

## Motivation
HyperAdmin has 19 milestones but no way to see completion status at a glance. Looking at v0.7.0 — is it 10% done or 90% done? You'd have to count stories manually.

## Proposed Solution
Add computed fields to milestones and epics:
- `stories_total`: count of linked stories
- `stories_done`: count with status=done
- `progress`: percentage (done/total)
- `blocked`: count of stories with no assignee or stale

Show in:
- CLI: `gitpm status` command with progress bars
- UI: progress bars in sidebar, roadmap timeline, tree browser
- .meta: optionally write computed stats to a `stats.yaml` file

## Impact
This turns the roadmap from a passive timeline into an actionable dashboard.
