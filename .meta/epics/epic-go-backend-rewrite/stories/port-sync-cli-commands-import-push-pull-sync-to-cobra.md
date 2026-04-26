---
type: story
id: k3Y8OTe0DzBB
title: Port sync CLI commands (import, push, pull, sync) to cobra
status: backlog
priority: high
assignee: null
labels:
  - go
  - migration
  - sync
  - cli
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:14.732Z
updated_at: 2026-04-26T20:06:14.732Z
---

**Phase 2 — CLI**

Port sync-related CLI commands to cobra.

- `gitpm import --token <token>` — one-time GitHub import
- `gitpm push --token <token> [--yes] [--dry-run]` — push .meta/ to GitHub
- `gitpm pull --token <token> [--dry-run]` — pull GitHub changes to .meta/
- `gitpm sync --token <token> [--strategy local-wins|remote-wins|ask] [--dry-run]` — bidirectional sync
- Interactive conflict resolution UI using `bubbletea`
- Spinner-based progress UI with per-entity status

**Source reference**: `packages/cli/src/commands/import.ts`, `push.ts`, `pull.ts`, `sync.ts` (~400 LOC)

**Acceptance criteria**:
- All sync commands work end-to-end against GitHub
- `--dry-run` shows what would change without modifying anything
- Interactive conflict resolution works for `--strategy ask`
