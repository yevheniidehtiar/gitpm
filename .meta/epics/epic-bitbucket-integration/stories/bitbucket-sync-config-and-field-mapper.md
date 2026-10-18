---
type: story
id: qjxN0Vrcs2oC
title: Bitbucket sync config and field mapper
status: done
priority: high
assignee: null
labels:
  - integration
  - story
estimate: 2
epic_ref:
  id: KVvXwhgJEyic
github:
  issue_number: 284
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:2c8f3af2fa9c71a2c1c261ef5dd3f95b087ba35846e0027701e414c32812d44c
  synced_at: 2026-10-18T19:45:46.886Z
created_at: 2026-10-17T08:22:43.848Z
updated_at: 2026-10-18T20:47:38.613Z
---

Add `.meta/sync/bitbucket-config.yaml` (zod schema) and `mapper.ts`:
- Config: workspace, repo_slug, status/priority/kind mapping overrides, epic linkage strategy
- Status: new/open → todo, on hold → backlog, resolved → done, closed/invalid/duplicate/wontfix → cancelled (overridable)
- Priority: trivial/minor → low, major → medium, critical → high, blocker → critical
- Kind (bug/enhancement/proposal/task) stored as a label on the GitPM side
- Epics: Bitbucket has no hierarchy, so map epics to a component and keep a hidden `<!-- gitpm:epic=<id> -->` marker in the issue body as a fallback
- Unit tests for every mapping in both directions
