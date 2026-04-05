---
type: story
id: JPp4fFVERKjs
title: Implement .meta/ → Jira export flow
status: done
priority: medium
assignee: null
labels:
  - integration
  - story
estimate: null
epic_ref:
  id: Zd3_Edq4ltwq
github:
  issue_number: 21
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:a1117e3687df200ac9f304f2b11a320889960ef9446e48e0e8107910c1f974a0
  synced_at: 2026-04-05T22:49:13.858Z
created_at: 2026-04-04T20:07:59.000Z
updated_at: 2026-04-04T20:07:59.000Z
---

Export `.meta/` entities back to Jira:
- Create new Jira issues from local-only entities
- Update existing Jira issues from modified entities
- Map GitPM status → Jira workflow transitions
- Handle Jira required fields gracefully

Part of #11
