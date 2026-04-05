---
type: story
id: cd2qQUPpL8SD
title: Implement .meta/ → GitLab export flow
status: done
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
  last_sync_hash: sha256:37eebf9e75035e3b64d9ffec0c8b64cd3adf77311ecdacf7d82a8790f064106f
  synced_at: 2026-04-05T23:44:25.167Z
created_at: 2026-04-04T20:08:09.000Z
updated_at: 2026-04-04T20:08:09.000Z
---

Export `.meta/` entities to GitLab:
- Create new GitLab issues from local-only entities
- Update existing GitLab issues from modified entities
- Assign to milestones, apply labels
- Support GitLab issue weights from priority field

Part of #12
