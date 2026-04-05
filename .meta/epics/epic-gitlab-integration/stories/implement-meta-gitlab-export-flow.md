---
type: story
id: cd2qQUPpL8SD
title: Implement .meta/ → GitLab export flow
status: todo
priority: medium
assignee: null
labels:
  - integration
  - story
estimate: null
epic_ref:
  id: 7d7n5ZMxSPon
github:
  issue_number: 25
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:26c08993c6d9bc71f1cbe009cdfa15fa92777104b80e990cbfbd4b860b6c5503
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:08:09Z
updated_at: 2026-04-04T20:08:09Z
---

Export `.meta/` entities to GitLab:
- Create new GitLab issues from local-only entities
- Update existing GitLab issues from modified entities
- Assign to milestones, apply labels
- Support GitLab issue weights from priority field

Part of #12
