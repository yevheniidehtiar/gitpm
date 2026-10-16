---
type: story
id: j7ert-mCERcK
title: Port GitHub sync adapter to Go using google/go-github
status: backlog
priority: high
assignee: null
labels:
  - go
  - migration
  - sync
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:12.168Z
updated_at: 2026-04-26T20:06:12.168Z
github:
  issue_number: 230
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:abba855e29408b07ada571603b2662d2334d2033b534a1a4e6b2d0abe3c9978b
  synced_at: 2026-04-26T20:12:30.005Z
---

**Phase 2 — Sync**

Port `packages/sync-github/src/` to `go/internal/sync/github/` using `google/go-github`.

- API client wrapper with rate-limit detection and pagination
- Issue CRUD (list, get, create, update)
- Milestone CRUD
- Sub-issues API (beta, graceful fallback)
- Entity ↔ GitHub issue/milestone mapper
- Import flow: GitHub → .meta/ (with epic linking strategies)
- Export flow: .meta/ → GitHub (create/update)

**Source reference**: `packages/sync-github/src/client.ts` (~298 LOC), `mapper.ts` (~237 LOC), `import.ts` (~250 LOC), `export.ts` (~293 LOC)

**Acceptance criteria**:
- Sync produces identical GitHub issues to TypeScript version
- Rate limiting works correctly under load
- Import correctly links stories to epics
