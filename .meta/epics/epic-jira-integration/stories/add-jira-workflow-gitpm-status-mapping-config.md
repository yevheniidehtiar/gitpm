---
type: story
id: VOIQcpzUMCJU
title: Add Jira workflow → GitPM status mapping config
status: todo
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
  last_sync_hash: sha256:4aa6fcdc67fac3d6583f91e7b67aeae0beec67ab5d94bcb3bb71dc15f6345e40
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:08:02Z
updated_at: 2026-04-04T20:08:02Z
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
