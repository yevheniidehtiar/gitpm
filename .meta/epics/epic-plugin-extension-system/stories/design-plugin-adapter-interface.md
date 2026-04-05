---
type: story
id: nwlaRRndXuRM
title: Design plugin adapter interface
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
  issue_number: 26
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:2a39ad8f02e2b8e6bdd68e46ecf3df38ac72db3aee6f01e5bdea0a167f222949
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:08:13Z
updated_at: 2026-04-04T20:08:13Z
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
