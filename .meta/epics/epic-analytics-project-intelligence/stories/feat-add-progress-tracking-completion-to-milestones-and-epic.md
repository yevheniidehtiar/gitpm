---
type: story
id: XDbbOigUWenB
title: "feat: add progress tracking (completion %) to milestones and epics"
status: done
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
  last_sync_hash: sha256:a6a24be819a32d62b637057b279d9b9914c8eae33a39f6b05305a04534d92c54
  synced_at: 2026-10-17T11:20:21.079Z
created_at: 2026-04-05T09:49:45.000Z
updated_at: 2026-10-16T22:21:22.011Z
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
