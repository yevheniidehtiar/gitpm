---
type: story
id: PhJp2EuK4z0s
title: Validate Go binary produces identical .meta/ output to TypeScript version
status: backlog
priority: critical
assignee: null
labels:
  - go
  - migration
  - testing
  - parity
estimate: null
epic_ref:
  id: 38Dhzqg4CU5j
created_at: 2026-04-26T20:06:15.604Z
updated_at: 2026-04-26T20:06:15.604Z
---

**Phase 2 — Validation**

Create an integration test suite that runs both the TypeScript and Go implementations against the same inputs and verifies identical outputs.

- For each CLI command, run both TS and Go versions on the same `.meta/` fixture
- Diff the file-system output (parse → write round-trips)
- Diff the JSON output of query/validate/show commands
- Diff GitHub API call sequences during sync (using a mock server)
- Automate as a CI job that blocks Go migration PRs

**Acceptance criteria**:
- Zero diff between TS and Go output for all commands on the project's own `.meta/`
- Zero diff on 3+ external test fixtures of varying complexity
- CI job passes on every PR to the migration branch
