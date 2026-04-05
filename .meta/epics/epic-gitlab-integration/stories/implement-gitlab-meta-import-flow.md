---
type: story
id: AxxhF0Nh6L4S
title: Implement GitLab → .meta/ import flow
status: todo
priority: medium
assignee: null
labels:
  - integration
  - story
estimate: null
epic_ref:
  id: 7d7n5ZMxSPon
github:
  issue_number: 24
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:21c4bf5c0a961e953cfa40ba966af804c2937c0251fc1d90f5244d93ae6641ba
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:08:06Z
updated_at: 2026-04-04T20:08:06Z
---

Import GitLab project data into `.meta/`:
- GitLab Milestones → GitPM Milestones
- GitLab Epics (premium) → GitPM Epics
- GitLab Issues → GitPM Stories
- GitLab labels → GitPM labels
- GitLab weights → GitPM priority mapping

CLI: `gitpm import --source gitlab --project namespace/project`

Part of #12
