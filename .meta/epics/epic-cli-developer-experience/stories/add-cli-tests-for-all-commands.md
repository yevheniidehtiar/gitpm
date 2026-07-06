---
type: story
id: F6g7j1oPthfW
title: Add CLI tests for all commands
status: in_progress
priority: medium
assignee: null
labels:
  - story
  - testing
estimate: null
epic_ref:
  id: wgH3wHt20_Ap
github:
  issue_number: 30
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:fd9017a26ded5bc55c7a3773c25b7e878b45ec1aa8ddb636ab689f1155defc41
  synced_at: 2026-07-06T17:45:17.707Z
created_at: 2026-04-04T20:08:28.000Z
updated_at: 2026-07-06T17:43:19.212Z
---

Currently the CLI has 0 tests. Add Vitest tests for:
- `gitpm init` — creates correct file structure
- `gitpm validate` — reports valid/invalid trees
- `gitpm import` — mocked GitHub client, verifies .meta/ output
- `gitpm push` — mocked client, verifies API calls
- `gitpm pull` — mocked client, verifies file updates
- `gitpm sync` — conflict resolution strategies

Use temp directories and mocked Octokit for all tests.
