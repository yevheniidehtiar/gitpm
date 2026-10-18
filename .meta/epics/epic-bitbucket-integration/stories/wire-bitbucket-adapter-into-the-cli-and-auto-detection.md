---
type: story
id: HBCmoeWHPkvq
title: Wire Bitbucket adapter into the CLI and auto-detection
status: in_review
priority: medium
assignee: null
labels:
  - integration
  - story
estimate: 2
epic_ref:
  id: KVvXwhgJEyic
github:
  issue_number: 289
  repo: yevheniidehtiar/gitpm
  last_sync_hash: sha256:67c0e39bfde91a9b5eb21bdf626215cb0b8ff49b8681db009e014d75628d78ba
  synced_at: 2026-10-17T11:20:25.757Z
created_at: 2026-10-17T08:22:45.600Z
updated_at: 2026-10-18T19:45:22.213Z
---

- Register `@gitpm/sync-bitbucket` in adapter loading and auto-detection (`detectAdapter`)
- Resolve tokens per adapter: `--token`, `BITBUCKET_TOKEN` and `BITBUCKET_EMAIL`; never log or persist them
- Add Bitbucket to the "no adapters installed" hint in `packages/cli/src/utils/adapters.ts`
- Update `adapters.test.ts` and `import.test.ts`, which currently use `bitbucket` as the example of an unknown adapter
- CLI tests against a temporary `.meta` tree
