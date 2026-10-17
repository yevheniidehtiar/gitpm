---
type: story
id: Bjw4u-hEDjqh
title: Upgrade CLI to commander 15
status: in_review
priority: medium
assignee: null
labels:
  - dependencies
  - cli
estimate: null
epic_ref:
  id: 3xy8aacTSvZu
github:
  issue_number: 261
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:3f41ae5cce1eceefdf3470d39b58af33618ec1d4f03bd4be1ca45a6c1fc1a390
  synced_at: 2026-10-16T21:52:46.701Z
created_at: 2026-10-16T21:51:41.391Z
updated_at: 2026-10-17T07:30:32.155Z
---

## Why

`@gitpm/cli` is built on commander 14. Dependabot proposed 15.0.0 in #239, and it is a major release.

## Scope

- 44 files in packages/cli import commander. Check the commander 15 changelog for breaking changes (option parsing, `.opts()` typing, help output, Node version floor) and adapt.
- Keep the CLI surface identical: same commands, flags and exit codes.

## Acceptance criteria

- [ ] `bun run build` and `bun run test` pass, including the CLI integration tests
- [ ] `gitpm --help` and every `gitpm <cmd> --help` output is unchanged, or the changes are intentional and reflected in docs/cli-reference.md
- [ ] Node 20 and 22 builds (Build Matrix) stay green
