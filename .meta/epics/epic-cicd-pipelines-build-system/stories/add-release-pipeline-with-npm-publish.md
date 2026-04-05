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
  last_sync_hash: sha256:c15e59fd14c630f6499913bab0b6946416152a4e4103e96480aff3939845b8a0
  synced_at: 2026-04-05T22:49:11.693Z
created_at: 2026-04-04T20:07:41.000Z
updated_at: 2026-04-04T20:07:41.000Z
---

Automated release workflow triggered by version tags (`v*`):
- Build all packages
- Run full test suite
- Publish `@gitpm/core`, `@gitpm/sync-github`, `gitpm` to npm
- Generate changelog from conventional commits
- Create GitHub Release with notes

Part of #10
