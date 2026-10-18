---
type: story
id: HBCmoeWHPkvq
title: Wire Bitbucket adapter into the CLI and auto-detection
status: done
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
  last_sync_hash: sha256:1ccd9887562d4484676e59fba4037b260d38a1d067afcb8a39ac0d542fa54aff
  synced_at: 2026-10-18T19:45:47.608Z
created_at: 2026-10-17T08:22:45.600Z
updated_at: 2026-10-18T20:47:39.105Z
---

- Register `@gitpm/sync-bitbucket` in adapter loading and auto-detection (`detectAdapter`)
- Resolve tokens per adapter: `--token`, `BITBUCKET_TOKEN` and `BITBUCKET_EMAIL`; never log or persist them
- Add Bitbucket to the "no adapters installed" hint in `packages/cli/src/utils/adapters.ts`
- Update `adapters.test.ts` and `import.test.ts`, which currently use `bitbucket` as the example of an unknown adapter
- CLI tests against a temporary `.meta` tree
