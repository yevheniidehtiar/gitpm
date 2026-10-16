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
  last_sync_hash: sha256:2ea6c81b4896ad1fb118ec95814728465f31bf15d64b20198a53ee58948c92ab
  synced_at: 2026-10-16T21:52:53.019Z
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
