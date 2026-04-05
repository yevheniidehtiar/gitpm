---
type: story
id: cX_BmyEwnGdN
title: Add build matrix for Node.js 20/22 and Bun
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
  issue_number: 16
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:4c103993d1b8b8187ad250e4f324ee58f50d9732bb61a99beade7e3ab5b845a8
  synced_at: 2026-04-05T22:49:12.507Z
created_at: 2026-04-04T20:07:44.000Z
updated_at: 2026-04-04T20:07:44.000Z
---

Extend CI to test across multiple runtimes:
- Node.js 20 LTS
- Node.js 22 LTS
- Bun latest

Ensure all packages build and tests pass on each. Report failures per-runtime.

Part of #10
