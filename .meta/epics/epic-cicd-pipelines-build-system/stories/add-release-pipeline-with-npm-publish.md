---
type: story
id: O2OtKYVLZRXY
title: Add release pipeline with npm publish
status: done
priority: medium
assignee: null
labels:
  - ci/cd
  - story
estimate: null
epic_ref:
  id: 0KmESSRSd002
github:
  issue_number: 15
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:2c6f449e4b76e3e4fba5025849acb99ca302348361b9b62160d702558e5d4ab2
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:07:41Z
updated_at: 2026-04-04T20:07:41Z
---

Automated release workflow triggered by version tags (`v*`):
- Build all packages
- Run full test suite
- Publish `@gitpm/core`, `@gitpm/sync-github`, `gitpm` to npm
- Generate changelog from conventional commits
- Create GitHub Release with notes

Part of #10
