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
  last_sync_hash: sha256:831de208571fbfbdda2a109cec8c477deee515bc31d0d47f23d492118a17e1a1
  synced_at: 2026-04-05T17:24:12.493Z
created_at: 2026-04-04T20:08:16Z
updated_at: 2026-04-04T20:08:16Z
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
