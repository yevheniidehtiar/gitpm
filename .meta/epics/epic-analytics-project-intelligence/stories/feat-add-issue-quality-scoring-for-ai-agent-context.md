---
type: story
id: YTEAoETh3A7C
title: "feat: add issue quality scoring for AI agent context"
status: done
priority: medium
assignee: null
labels:
  - enhancement
  - cli
  - core
estimate: null
epic_ref:
  id: Jm9BOEIh35z1
github:
  issue_number: 43
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:5995670c628d76f2f7646a4d4e13e59075f2214e378e6c77d4563e688963d10f
  synced_at: 2026-04-26T09:40:16.698Z
created_at: 2026-04-05T09:49:45.000Z
updated_at: 2026-04-12T16:06:36.793Z
---

## Motivation
HyperAdmin has a mix of high-quality issues (detailed epic with sub-issues, acceptance criteria) and low-quality ones (one-line title, no body, no labels). When Claude Code reads .meta/ for context, low-quality issues waste tokens and provide no value.

## Proposed Solution
`gitpm quality` command that scores each entity:
- **Has body?** (+2)
- **Body > 100 chars?** (+1)
- **Has labels?** (+1)
- **Has assignee?** (+1)
- **Has acceptance criteria / checklist?** (+2)
- **Linked to epic?** (+1)
- **Has milestone?** (+1)

Score 0-9, grade A/B/C/D/F. Report by grade with counts.

Also add a `.meta/.gitpm/quality-threshold.yaml` config that fails validation if average quality drops below a threshold — enforceable in CI.

## Why This Matters
Git-native PM is only useful if the data is high quality. This creates a feedback loop: import from GitHub → score → identify gaps → improve → re-sync.
