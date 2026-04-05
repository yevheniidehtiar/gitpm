---
type: epic
id: 7d7n5ZMxSPon
title: "[Epic] GitLab Integration"
status: done
priority: medium
owner: null
labels:
  - integration
milestone_ref:
  id: lFNL-hn79Edx
github:
  issue_number: 12
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:f9ba746c3fc3313f0a877a3b4cae8ade75c790b90e25dd6ab72deb8e502cc6f0
  synced_at: 2026-04-05T23:44:23.279Z
created_at: 2026-04-04T20:07:26.000Z
updated_at: 2026-04-04T20:07:26.000Z
---

## Overview
Add bidirectional sync between `.meta/` project tree and GitLab Issues/Milestones/Epics.

## Goals
- Import GitLab issues, milestones, and epics into `.meta/`
- Export `.meta/` entities to GitLab
- Support GitLab.com and self-hosted instances
- Map GitLab labels and weights to GitPM fields

## Architecture
New package: `@gitpm/sync-gitlab` following the same adapter pattern as `@gitpm/sync-github`.
