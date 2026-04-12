---
type: epic
id: 9_EjGg7jTN0Y
title: "[Epic] Sync Reliability & Resilience"
status: done
priority: high
owner: null
labels:
  - enhancement
  - sync
milestone_ref:
  id: lFNL-hn79Edx
github:
  issue_number: 65
  repo: yevheniidehtiar/gitpm
  synced_at: 2026-04-06T12:53:26.000Z
created_at: 2026-04-06T00:00:00.000Z
updated_at: 2026-04-12T10:53:13.523Z
---

## Overview
Harden the sync engine to handle real-world failure modes: API errors mid-sync, lost sync state files, and poor epic-story linkage during import. Sync is the core value proposition of GitPM.

## Goals
- Reconstruct sync state from entity frontmatter when github-state.json is missing
- Add checkpoint-based error recovery so sync can resume after failure
- Improve heuristics for linking stories to epics during import (sub-issues, milestones, labels)

## Priority
P1 — High. Core reliability for production use with large repos.

## Sub-issues
- [ ] Reconstruct sync state from entity frontmatter on startup (#36)
- [ ] Add error recovery and resumable sync (#29)
- [ ] Improve epic-story linkage during import (#35)
