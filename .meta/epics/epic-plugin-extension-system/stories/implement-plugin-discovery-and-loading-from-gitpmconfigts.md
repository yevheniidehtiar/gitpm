---
type: story
id: HBphXVPZZxd_
title: Implement plugin discovery and loading from gitpm.config.ts
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
  issue_number: 27
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:d39e8c1dcd480055bdb0c47970cc98d475f966c7f0ad01fe4a84942533aeebc7
  synced_at: 2026-04-26T20:12:33.617Z
created_at: 2026-04-04T20:08:16.000Z
updated_at: 2026-04-04T20:08:16.000Z
---

Load sync adapters dynamically from config:

```typescript
// gitpm.config.ts
export default {
  adapters: [
    '@gitpm/sync-github',
    '@gitpm/sync-jira',
    './custom-adapter.ts',
  ],
  hooks: {
    'pre-sync': './scripts/validate.ts',
    'post-import': './scripts/notify.ts',
  }
};
```

Use dynamic `import()` with validation that loaded modules implement `SyncAdapter`.

Part of #13
