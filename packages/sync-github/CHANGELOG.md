# Changelog

## [0.1.7](https://github.com/yevheniidehtiar/gitpm/compare/sync-github-v0.1.6...sync-github-v0.1.7) (2026-04-12)


### Features

* implement Plugin & Extension System epic ([#151](https://github.com/yevheniidehtiar/gitpm/issues/151)) ([86df984](https://github.com/yevheniidehtiar/gitpm/commit/86df9844d5b995527aa036989f305d35f515c36c))


### Bug Fixes

* resolve Biome formatting issues in checkpoint and sync modules ([0f26944](https://github.com/yevheniidehtiar/gitpm/commit/0f2694414649b19f580f9e4d450383db8bcb2f58))
* **sync-github:** address Claude Review findings — Zod schema, dryRun guard, checkpoint error surfacing ([380b467](https://github.com/yevheniidehtiar/gitpm/commit/380b467893b5a8711112ae8ae8d53c70d7232807))
* **sync-github:** gate saveProgress behind dryRun and prevent duplicate failedEntities ([72536aa](https://github.com/yevheniidehtiar/gitpm/commit/72536aac10d49a35a7f54ef4d1a75ac12a9b1609))
* **sync-github:** surface checkpoint errors and add error-recovery tests ([99b2b7f](https://github.com/yevheniidehtiar/gitpm/commit/99b2b7f892fa93eadd9f34a6a0cf25e28435f295))
* **sync-github:** validate checkpoint data and surface sync failures in CLI ([23a08ae](https://github.com/yevheniidehtiar/gitpm/commit/23a08aeba581e1b374e04d48ffbb9b0cba09bd21))

## [0.1.6](https://github.com/yevheniidehtiar/gitpm/compare/sync-github-v0.1.5...sync-github-v0.1.6) (2026-04-12)


### Bug Fixes

* clean up unreleased changes from PRs [#141](https://github.com/yevheniidehtiar/gitpm/issues/141) and [#144](https://github.com/yevheniidehtiar/gitpm/issues/144) ([d7a9b54](https://github.com/yevheniidehtiar/gitpm/commit/d7a9b54ffbab29ddd5e66fe334afc98e359ea0ae))

## [0.1.5](https://github.com/yevheniidehtiar/gitpm/compare/sync-github-v0.1.4...sync-github-v0.1.5) (2026-04-07)


### Bug Fixes

* resolve Biome lint warnings across codebase ([8737c22](https://github.com/yevheniidehtiar/gitpm/commit/8737c227e261548344fccbee1926b8784d8ea74d))

## [0.1.4](https://github.com/yevheniidehtiar/gitpm/compare/sync-github-v0.1.3...sync-github-v0.1.4) (2026-04-06)


### Bug Fixes

* adapt codebase for Biome 2.x, TypeScript 6.x, and Vitest 4.x ([ebb5d75](https://github.com/yevheniidehtiar/gitpm/commit/ebb5d75e6580efe1a1ebb6e52be5d9b842d914ab))

## [0.1.3](https://github.com/yevheniidehtiar/gitpm/compare/sync-github-v0.1.2...sync-github-v0.1.3) (2026-04-06)


### Bug Fixes

* release workflow tag pattern, npm auth, and changelog cleanup ([23e4055](https://github.com/yevheniidehtiar/gitpm/commit/23e4055871eaedb91e68e9c776f24835f1e1019c))

## [0.1.2](https://github.com/yevheniidehtiar/gitpm/compare/sync-github-v0.1.1...sync-github-v0.1.2) (2026-04-06)


### Features

* add e2e lifecycle test and fix import path resolution ([84f301e](https://github.com/yevheniidehtiar/gitpm/commit/84f301e948fb1506f3b0169a41577318c1c682c1))
* add e2e UI capture script and hyper-admin demo screenshots ([b1f11f6](https://github.com/yevheniidehtiar/gitpm/commit/b1f11f6c4840fb39ebd591e2e6b2b8de263bae39))
* complete P0 open-source readiness & security hardening epic ([3b49420](https://github.com/yevheniidehtiar/gitpm/commit/3b49420ff85d43a8e86bf9127573562c101aafd4))
* implement @gitpm/core schema engine (Phase 1) ([646bff0](https://github.com/yevheniidehtiar/gitpm/commit/646bff0c1a59a6faae7ce926eaa524665301e16c))
* implement @gitpm/sync-github export & bidirectional sync (Phase 4) ([ec486c4](https://github.com/yevheniidehtiar/gitpm/commit/ec486c4ef3e2552ba5cd440eeeee18165ae366e7))
* implement @gitpm/sync-github import from GitHub (Phase 3) ([adcc6cd](https://github.com/yevheniidehtiar/gitpm/commit/adcc6cde3efffc26746017e6c5cba8dad05a344a))
* improve epic-story linkage with fallback heuristics ([#35](https://github.com/yevheniidehtiar/gitpm/issues/35)) ([2d74a9e](https://github.com/yevheniidehtiar/gitpm/commit/2d74a9e5bed3795abf742f05a7faaaacc7985258))
* map GitHub labels to priority field during import ([#34](https://github.com/yevheniidehtiar/gitpm/issues/34)) ([5b3d522](https://github.com/yevheniidehtiar/gitpm/commit/5b3d5224c1b8a7a65293d45c95c80e90aa6a8d05))
* scaffold monorepo with Bun workspaces (Phase 0) ([cb9dd62](https://github.com/yevheniidehtiar/gitpm/commit/cb9dd62eddf2c1b792918193268b2f688cfb2c10))


### Bug Fixes

* export closes done/cancelled issues on GitHub regardless of hash match ([10a9f05](https://github.com/yevheniidehtiar/gitpm/commit/10a9f05946828cf6c701c33aa36c2e3f0c9ff088))
* npm publish prep — files field, CLI rename, Trusted Publishing ([ae99c78](https://github.com/yevheniidehtiar/gitpm/commit/ae99c7863afdfb43913247817525999cc943469c))
* resolve Biome lint warnings in linker tests ([718f657](https://github.com/yevheniidehtiar/gitpm/commit/718f657533b622a9623ba5cfa145b844101d521b))
* resolve import path bug and increase API timeout ([58c9a40](https://github.com/yevheniidehtiar/gitpm/commit/58c9a40f22c30d6b6e2feb7dc226ce9d98f9a3e4))
* resolve TypeScript build errors in @gitpm/sync-github ([fced571](https://github.com/yevheniidehtiar/gitpm/commit/fced571bf7530877a894002a68020831a00ec72c))
