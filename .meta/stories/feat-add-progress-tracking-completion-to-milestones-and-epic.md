---
type: story
id: XDbbOigUWenB
title: "feat: add progress tracking (completion %) to milestones and epics"
status: todo
priority: medium
assignee: null
labels:
  - enhancement
  - ui
  - core
estimate: null
epic_ref: null
github:
  issue_number: 42
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:da2d36ac16494c4e674dc1b73e2b7cfc7917e7ab1d46549a13b90397a809993f
  synced_at: 2026-04-05T17:24:12.493Z
created_at: 2026-04-05T09:49:45Z
updated_at: 2026-04-05T09:49:45Z
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
