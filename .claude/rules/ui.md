---
paths:
  - "packages/ui/**"
---

# UI package

- React code may throw and use error boundaries. The library `Result<T, E>` rule does not apply here. API calls go through the hooks in `src/lib/api.ts`.
- Playwright specs live in `e2e/*.spec.ts` and run in the `ui-e2e` job. New user-visible behaviour needs a spec, or a sentence in the PR explaining why not.
- The entity editor renders Markdown bodies that came from external trackers. Keep sanitisation on; a previous XSS fix depends on it.
- `pages.yml` publishes the demo to https://yevheniidehtiar.github.io/gitpm/demo/ on `ui-v*` tags, together with the docs site. `build:demo` defaults the Vite base to `/gitpm/demo/` (override with `VITE_BASE`). The UI uses hash routing, so no router basepath is needed. Nothing to do manually.
