---
type: story
id: 1Wr5FXlE8Mn-
title: "fix(sync-github): push closes issues whose entity is done even when the sync hash is unchanged"
status: backlog
priority: high
assignee: null
labels:
  - sync
  - bug
estimate: null
epic_ref:
  id: 9_EjGg7jTN0Y
created_at: 2026-10-20T06:50:46.216Z
updated_at: 2026-10-20T06:50:46.216Z
github:
  issue_number: 305
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:23cafefb20c1e4f0e0270a2ca2afed0e1b8aa635797097e7fc133f2bc8db839a
  synced_at: 2026-10-20T06:51:03.480Z
---

## Problem

`gitpm push` decides what to update by comparing each entity's local content hash with `last_sync_hash`. It never looks at the live GitHub issue state. When the two drift apart (an issue reopened by hand, a close that never ran, a hash written without the matching PATCH), push reports 0 changes and the issue stays open forever.

On 2026-10-20, 13 entities with `status: done` had open issues (#13, #29, #35–#40, #165–#169) and push skipped every one of them. They were closed by hand with `gh issue close`.

## Acceptance criteria

- push (or a cheap pre-pass) compares the remote open/closed state of linked issues against the mapped local status, and sends a state-only PATCH when they differ, even if the content hash is unchanged
- `--dry-run` lists these as "state drift" updates
- Uses one paginated issue list call, not one call per entity
- Fixture tests: done/open → closed; todo/closed → reopened; unchanged → no call
