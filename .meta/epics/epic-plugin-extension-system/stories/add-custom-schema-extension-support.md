---
type: story
id: qOHmlWWEwsLd
title: Add custom schema extension support
status: done
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
  last_sync_hash: sha256:361515d502ca7badb373ddd9d828fcabda72ca20d193f3fb43b826f2a7a96a6b
  synced_at: 2026-04-26T20:12:32.684Z
created_at: 2026-04-04T20:08:20.000Z
updated_at: 2026-04-04T20:08:20.000Z
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
