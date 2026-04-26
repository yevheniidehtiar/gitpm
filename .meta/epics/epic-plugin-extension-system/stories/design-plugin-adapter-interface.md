---
type: story
id: nwlaRRndXuRM
title: Design plugin adapter interface
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
  issue_number: 26
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:f4eec993c9e5af82a6cebda5ee9e6b09d914f134779d32d935ce628e12f109a5
  synced_at: 2026-04-26T20:12:33.144Z
created_at: 2026-04-04T20:08:13.000Z
updated_at: 2026-04-04T20:08:13.000Z
---

Define the `SyncAdapter` interface that all integrations implement:

```typescript
interface SyncAdapter {
  name: string;
  import(config: AdapterConfig): Promise<Result<ImportResult>>;
  export(config: AdapterConfig, tree: MetaTree): Promise<Result<ExportResult>>;
  diff(local: MetaTree, remote: RemoteState): Promise<DiffResult>;
  resolveConflicts(conflicts: Conflict[], strategy: Strategy): Promise<Resolution[]>;
}
```

This enables `@gitpm/sync-github`, `@gitpm/sync-jira`, `@gitpm/sync-gitlab` to share CLI/UI code.

Part of #13
