---
type: epic
id: K-RoyLf07OKQ
title: "[Epic] UI Core Experience"
status: in_progress
priority: high
owner: null
labels:
  - enhancement
  - ui
milestone_ref:
  id: lFNL-hn79Edx
github:
  issue_number: 66
  repo: yevheniidehtiar/gitpm
  synced_at: 2026-04-06T12:53:26.000Z
created_at: 2026-04-06T00:00:00.000Z
updated_at: 2026-04-12T10:53:15.854Z
---

## Overview
Make the GitPM UI viable for daily production use. Virtual scrolling enables handling large projects, kanban board provides the workflow view every PM tool needs, and the editor improvements round out the experience.

## Goals
- Virtual scrolling for Tree Browser to handle 1000+ entities efficiently
- Kanban board view with drag-and-drop status transitions
- Assignee filtering for team-based workflows
- Markdown preview with proper sanitization for entity editing

## Priority
P1 — High. The UI must be usable at scale for v1.0.

## Sub-issues
- [ ] Add virtual scrolling to Tree Browser (#37)
- [ ] Add kanban board view — columns by status (#38)
- [ ] Add assignee filter to Tree Browser (#39)
- [ ] Add markdown preview/split view in entity editor (#40)
