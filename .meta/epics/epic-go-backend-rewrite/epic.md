---
type: epic
id: 38Dhzqg4CU5j
title: "[Epic] Go Backend Rewrite"
status: backlog
priority: high
owner: null
labels:
  - go
  - migration
  - backend
milestone_ref: null
created_at: 2026-04-26T20:05:24.415Z
updated_at: 2026-04-26T20:05:24.415Z
---

## Overview

Rewrite GitPM's backend (packages/core, sync-github, cli) from TypeScript to Go for better performance, single-binary distribution, and faster startup time. The React UI stays in TypeScript.

## Motivation

- **Startup time**: Go CLI binaries start in ~5-10ms vs 50-200ms for Bun/Node
- **Distribution**: Single static binary via `goreleaser`, no runtime dependency
- **Concurrency**: Goroutines make parallel file I/O and API calls trivial
- **Ecosystem fit**: `gh` CLI, Hugo, and kubectl prove Go is ideal for this workload

## Migration Strategy

**Phase 1 — Core + CLI** (~8k LOC): Port schema engine, parser, resolver, validator, writer, query, and all CLI commands. Go binary replaces `packages/core` + `packages/cli`.

**Phase 2 — Sync Engine** (~3k LOC): Port GitHub sync adapter (diff, state, mapper, sync/import/export). Replace `@octokit/rest` with `google/go-github`.

The `.meta/` file tree remains the integration boundary. The UI reads `.meta/` files directly or via the Go binary's JSON output.

## Key Libraries

- `cobra` — CLI framework
- `gopkg.in/yaml.v3` — YAML parsing
- `adrg/frontmatter` — frontmatter extraction
- `google/go-github` — GitHub API (Phase 2)
- `charmbracelet/bubbletea` — terminal UI (progressive enhancement)

## Priority

P1 — High. Foundational infrastructure change.
