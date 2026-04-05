---
type: story
id: AxxhF0Nh6L4S
title: Implement GitLab → .meta/ import flow
status: done
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
  last_sync_hash: sha256:4d980f124cc81b98bda2eea5313e78502fd7b91b31aa129f5dace9fa7397d9d6
  synced_at: 2026-04-05T23:44:24.503Z
created_at: 2026-04-04T20:08:06.000Z
updated_at: 2026-04-04T20:08:06.000Z
---

Import GitLab project data into `.meta/`:
- GitLab Milestones → GitPM Milestones
- GitLab Epics (premium) → GitPM Epics
- GitLab Issues → GitPM Stories
- GitLab labels → GitPM labels
- GitLab weights → GitPM priority mapping

CLI: `gitpm import --source gitlab --project namespace/project`

Part of #12
