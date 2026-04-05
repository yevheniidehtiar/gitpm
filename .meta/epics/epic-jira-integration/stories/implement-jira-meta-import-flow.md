---
type: story
id: 1eAGItyhM0gC
title: Implement Jira → .meta/ import flow
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
  issue_number: 20
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:4617a1dedcb5d795da1b2359755bc5805203125761fea85b545bd1f945172c08
  synced_at: 2026-04-05T22:49:13.443Z
created_at: 2026-04-04T20:07:56.000Z
updated_at: 2026-04-04T20:07:56.000Z
---

Import Jira project data into `.meta/` tree:
- Jira Epics → GitPM Epics
- Jira Stories/Tasks/Bugs → GitPM Stories
- Jira Sprints → GitPM Milestones
- Jira custom fields → frontmatter metadata
- Preserve Jira issue keys as sync IDs

CLI: `gitpm import --source jira --project KEY`

Part of #11
