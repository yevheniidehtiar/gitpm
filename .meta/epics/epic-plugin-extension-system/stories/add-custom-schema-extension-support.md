---
type: story
id: qOHmlWWEwsLd
title: Add custom schema extension support
status: todo
priority: medium
assignee: null
labels:
  - architecture
  - story
estimate: null
epic_ref:
  id: irf1l_XLbkDl
github:
  issue_number: 28
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:8735e807372b9db27bffcb5be956fcb20236dbca811d1087df8e3f5d3011e0f9
  synced_at: 2026-04-05T17:24:12.493Z
created_at: 2026-04-04T20:08:20Z
updated_at: 2026-04-04T20:08:20Z
---

Allow users to extend entity schemas with custom fields:

```yaml
# .meta/.gitpm/schema-extensions.yaml
story:
  fields:
    story_points:
      type: number
      required: false
    team:
      type: string
      enum: [platform, frontend, backend, infra]
```

Custom fields should appear in frontmatter, be preserved during sync, and show in the UI editor.

Part of #13
