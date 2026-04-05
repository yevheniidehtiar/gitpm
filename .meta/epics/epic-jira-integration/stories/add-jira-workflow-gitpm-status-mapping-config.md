---
type: story
id: VOIQcpzUMCJU
title: Add Jira workflow → GitPM status mapping config
status: done
priority: medium
assignee: null
labels:
  - integration
  - story
estimate: null
epic_ref:
  id: Zd3_Edq4ltwq
github:
  issue_number: 22
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:3982181d5e897f233604c10c499868f0341a48e1d24af9c6d3c177e2d758c1cd
  synced_at: 2026-04-05T22:49:14.840Z
created_at: 2026-04-04T20:08:02.000Z
updated_at: 2026-04-04T20:08:02.000Z
---

Jira workflows vary per project. Need a configurable mapping:

```yaml
# .meta/.gitpm/jira-config.yaml
status_map:
  "To Do": todo
  "In Progress": in-progress
  "In Review": in-progress
  "Done": done
  "Won't Do": cancelled
```

Include sensible defaults for common Jira workflows (Scrum, Kanban, simplified).

Part of #11
