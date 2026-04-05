---
type: story
id: F6g7j1oPthfW
title: Add CLI tests for all commands
status: todo
priority: medium
assignee: null
labels:
  - story
  - testing
estimate: null
epic_ref: null
github:
  issue_number: 30
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:7b5a8273de460b1e46da9656cb97f90727014feb98d7fcfb2a5073f0c52e9958
  synced_at: 2026-04-05T17:24:12.493Z
created_at: 2026-04-04T20:08:28Z
updated_at: 2026-04-04T20:08:28Z
---

Currently the CLI has 0 tests. Add Vitest tests for:
- `gitpm init` — creates correct file structure
- `gitpm validate` — reports valid/invalid trees
- `gitpm import` — mocked GitHub client, verifies .meta/ output
- `gitpm push` — mocked client, verifies API calls
- `gitpm pull` — mocked client, verifies file updates
- `gitpm sync` — conflict resolution strategies

Use temp directories and mocked Octokit for all tests.

