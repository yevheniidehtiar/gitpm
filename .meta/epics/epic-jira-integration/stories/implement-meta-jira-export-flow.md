---
type: story
id: JPp4fFVERKjs
title: Implement .meta/ → Jira export flow
status: todo
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
  last_sync_hash: sha256:774eace7f2cf01cb4cb97b126fe90a0c6dfab2652c87e4e84820c791198df5eb
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:07:59Z
updated_at: 2026-04-04T20:07:59Z
---

Export `.meta/` entities back to Jira:
- Create new Jira issues from local-only entities
- Update existing Jira issues from modified entities
- Map GitPM status → Jira workflow transitions
- Handle Jira required fields gracefully

Part of #11
