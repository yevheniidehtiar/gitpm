---
type: epic
id: KVvXwhgJEyic
title: "[Epic] Bitbucket Integration"
status: backlog
priority: medium
owner: null
labels:
  - integration
milestone_ref:
  id: lFNL-hn79Edx
created_at: 2026-10-17T08:22:26.498Z
updated_at: 2026-10-17T08:22:26.498Z
---

## Overview
Add bidirectional sync between the `.meta/` tree and Bitbucket Cloud Issues. This closes the last integration promised by the v1.0 milestone.

## Goals
- Import Bitbucket Cloud issues and milestones into `.meta/`
- Export `.meta/` stories and epics to Bitbucket issues
- Field-level 3-way sync with conflict detection, matching the other adapters
- Authenticate with Atlassian API tokens or workspace/repository access tokens (app passwords are deprecated)

## Constraints
- Bitbucket Data Center/Server has no issue tracker (it delegates to Jira), so the scope is **Bitbucket Cloud only**.
- Bitbucket issues have no labels and no parent/child hierarchy. Epic linkage needs a strategy (component, a marker in the issue body, or both).
- The REST 2.0 milestones, versions and components endpoints may be read-only. Verify this in the client story and degrade gracefully.
- The repository's issue tracker must be enabled.

## Architecture
New package `@gitpm/sync-bitbucket` that implements `SyncAdapter` from `@gitpm/core` with the same layout as `sync-gitlab` and `sync-linear`: `client.ts`, `config.ts`, `mapper.ts`, `import.ts`, `export.ts`, `sync.ts`, `diff.ts`, `conflict.ts`, `state.ts`, `adapter.ts`.
