---
paths:
  - "packages/core/**"
  - "packages/sync-*/**"
---

# Library packages (`core`, `sync-*`)

- Public functions return `Result<T, E>`. Wrap third-party calls that throw (octokit, fetch, fs) at the boundary and convert to `{ ok: false, error }`. Tests assert on `result.ok`, not on thrown errors.
- Build before running tests. `sync-*` import `@gitpm/core` from `dist/`; a stale `dist/` is the usual cause of "passes locally, fails in CI".
- Test against `packages/core/src/__fixtures__/valid-tree` and `broken-tree`. Add a fixture rather than mocking the file system. Never call a live API in tests; `nightly.yml` is the only live round-trip.
- `mapper.ts` is a bidirectional contract. `done` and `cancelled` map to `closed`, and `post-merge-sync.yml` relies on that to close issues. Change a mapping in both directions and update the status-mapping table in `docs/sync-guide.md`.
- Schema changes in `core` ripple into every adapter, the CLI and the UI. Run the whole workspace test suite, not only the package you touched.
