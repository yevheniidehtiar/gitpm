---
type: epic
id: irf1l_XLbkDl
title: "[Epic] Plugin & Extension System"
status: in_progress
priority: medium
owner: null
labels:
  - architecture
milestone_ref:
  id: lFNL-hn79Edx
github:
  issue_number: 13
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:0f9f2e94a0e4e80401003e51bc9dd10655a0dacb695a2d141aa6a3f2507f6e5d
  synced_at: 2026-07-06T17:45:14.135Z
created_at: 2026-04-04T20:07:29.000Z
updated_at: 2026-07-06T17:43:40.582Z
---

## Overview
Design a plugin architecture that allows third-party sync adapters, custom schema extensions, and CLI plugins.

## Goals
- Plugin discovery and loading via `gitpm.config.ts`
- Adapter interface that Jira/GitLab/Linear plugins implement
- Custom field definitions via schema extensions
- CLI plugin commands (e.g. `gitpm jira import`)
- Hook system for pre/post sync events
