---
type: story
id: cX_BmyEwnGdN
title: Add build matrix for Node.js 20/22 and Bun
status: todo
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
  last_sync_hash: sha256:abf0e3dadca3c1091709cf05428cce24aa1d6a12848b2c33f28f68f7e9268555
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:07:44Z
updated_at: 2026-04-04T20:07:44Z
---

Extend CI to test across multiple runtimes:
- Node.js 20 LTS
- Node.js 22 LTS
- Bun latest

Ensure all packages build and tests pass on each. Report failures per-runtime.

Part of #10
