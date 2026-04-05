---
type: story
id: 1eAGItyhM0gC
title: Implement Jira → .meta/ import flow
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
  issue_number: 20
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:282f9a6ad17a13cf253ffe6b10f9bfdd9c96f1be381bb7717c11eb846e4001e8
  synced_at: 2026-04-05T17:24:12.492Z
created_at: 2026-04-04T20:07:56Z
updated_at: 2026-04-04T20:07:56Z
---

Import Jira project data into `.meta/` tree:
- Jira Epics → GitPM Epics
- Jira Stories/Tasks/Bugs → GitPM Stories
- Jira Sprints → GitPM Milestones
- Jira custom fields → frontmatter metadata
- Preserve Jira issue keys as sync IDs

CLI: `gitpm import --source jira --project KEY`

Part of #11
