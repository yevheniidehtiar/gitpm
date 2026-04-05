---
type: story
id: ByzFySLXPYcc
title: "feat: map GitHub labels to priority field during import"
status: done
priority: medium
assignee: null
labels:
  - enhancement
  - sync
estimate: null
epic_ref: null
github:
  issue_number: 34
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:9fe1a505f0d6f37492d6ea1f3f5033dd0eec0ef0a4e36064b32a0ac94c699768
  synced_at: 2026-04-05T22:49:10.869Z
created_at: 2026-04-05T09:48:49.000Z
updated_at: 2026-04-05T09:48:49.000Z
---

## Problem
During import, all stories get `priority: medium` regardless of GitHub labels. Tested with hyper-admin (362 entities) — every single one was medium.

## Expected
GitHub labels like `priority:high`, `priority:critical`, `P0`, `P1` should be mapped to GitPM priority values (`low`, `medium`, `high`, `critical`).

## Proposed Solution
Add a `priority_mapping` config in `github-config.yaml`:
```yaml
priority_mapping:
  "priority:high": high
  "priority:critical": critical
  "P0": critical
  "P1": high
  "P2": medium
  "P3": low
```

Default heuristic: scan label names for priority keywords if no explicit mapping.

## Impact
Without this, the priority column in Tree Browser and any priority-based sorting/filtering is useless.
