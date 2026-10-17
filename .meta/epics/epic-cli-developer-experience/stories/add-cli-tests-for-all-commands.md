---
type: story
id: F6g7j1oPthfW
title: Add CLI tests for all commands
status: done
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
  last_sync_hash: sha256:fe8f82e6b0e7e481af0cebe313fa7cf3da433e11c231cc713a912791a232f6a0
  synced_at: 2026-10-17T11:20:26.526Z
created_at: 2026-04-04T20:08:28.000Z
updated_at: 2026-10-16T22:21:22.551Z
---

Currently the CLI has 0 tests. Add Vitest tests for:
- `gitpm init` — creates correct file structure
- `gitpm validate` — reports valid/invalid trees
- `gitpm import` — mocked GitHub client, verifies .meta/ output
- `gitpm push` — mocked client, verifies API calls
- `gitpm pull` — mocked client, verifies file updates
- `gitpm sync` — conflict resolution strategies

Use temp directories and mocked Octokit for all tests.
