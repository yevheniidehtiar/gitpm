---
type: story
id: rEqawSv7vre0
title: Add LICENSE file (MIT)
status: todo
priority: high
assignee: null
labels:
  - security
  - docs
estimate: null
epic_ref:
  id: bZoJF6Th8vEU
github:
  issue_number: 69
  repo: yevheniidehtiar/gitpm
  synced_at: 2026-04-06T12:53:26.000Z
created_at: 2026-04-06T00:00:00Z
updated_at: 2026-04-06T00:00:00Z
---

## Problem
The repository mentions MIT license in README.md but has no actual LICENSE file. Without a LICENSE file, the code is legally "all rights reserved" by default — making it not truly open-source.

## Acceptance Criteria
- [ ] Create `LICENSE` file at repo root with full MIT license text
- [ ] Ensure copyright year and holder are correct
- [ ] Verify `package.json` `license` field matches

## Impact
Blocking for any open-source adoption. Legal requirement.
