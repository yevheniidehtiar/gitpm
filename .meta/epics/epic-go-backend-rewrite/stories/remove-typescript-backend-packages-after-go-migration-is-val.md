---
type: story
id: P4PcxyZG8pPz
title: Remove TypeScript backend packages after Go migration is validated
status: backlog
priority: low
assignee: null
labels:
  - go
  - migration
  - cleanup
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:16.501Z
updated_at: 2026-04-26T20:06:16.501Z
github:
  issue_number: 234
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:b6eca68d4aa04cedbd9480d70f943635a960d2a9fa1055f08a2b3ebf5d2753d6
  synced_at: 2026-04-26T20:12:31.471Z
---

**Phase 2 — Cleanup**

After Go parity is validated, remove the TypeScript backend packages.

- Remove `packages/core/` (replaced by `go/internal/`)
- Remove `packages/sync-github/` (replaced by `go/internal/sync/github/`)
- Remove `packages/cli/` (replaced by `go/cmd/gitpm/`)
- Update `package.json` workspaces to only include `packages/ui`
- Update CI workflows to build Go binary + React UI
- Update `CLAUDE.md` with new project structure and commands
- Update documentation in `docs/`

**Acceptance criteria**:
- `go build ./cmd/gitpm` produces a working binary
- `bun run dev:ui` still works for the React UI
- All CI checks pass
- Documentation reflects the new structure
