---
type: story
id: OKEVLH7e5TsM
title: Migrate schemas from zod 3 to zod 4
status: todo
priority: high
assignee: null
labels:
  - dependencies
  - core
estimate: null
epic_ref:
  id: 3xy8aacTSvZu
created_at: 2026-10-16T21:51:40.335Z
updated_at: 2026-10-16T21:51:40.335Z
github:
  issue_number: 260
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:56ea4c53e98f89d115c66edcbf1e0a3e0bf5ba5de384a0767d91c3732e960885
  synced_at: 2026-10-16T21:52:45.895Z
---

## Why

zod 4 is a major release with API changes. `@gitpm/core` is built on zod: every entity schema and all validation go through it, and the sync adapters depend on it too. Staying on zod 3 blocks future fixes and Dependabot updates.

## Scope

- 11 non-test source files import zod (core and the sync-* packages). Usage is mostly `z.string` / `z.object` / `z.infer` / `z.enum`, plus `z.ZodObject` / `z.ZodRawShape` generics in the custom-schema extension support.
- 4 call sites use APIs that changed in v4 (`.passthrough()` / `.strict()` / `z.record` / `ZodError` formatting). Review each against the zod 4 migration guide.
- Bump `zod` in every package.json that declares it.

## Acceptance criteria

- [ ] All packages build and `bun run test` passes on zod 4
- [ ] Validation error messages surfaced by `gitpm validate` stay readable (update snapshots or tests deliberately, not blindly)
- [ ] Custom schema extensions (`gitpm.config.ts`) still work
- [ ] No `any` introduced to paper over type changes
