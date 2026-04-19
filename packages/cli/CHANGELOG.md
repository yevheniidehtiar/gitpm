# Changelog

## [0.1.9](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.8...cli-v0.1.9) (2026-04-12)


### Features

* implement Analytics & Project Intelligence epic ([5e50ba7](https://github.com/yevheniidehtiar/gitpm/commit/5e50ba7c0d8843cb9db6fca90b9ade9e544bd4a7))


### Bug Fixes

* address Claude Review findings on analytics PR ([d7f1043](https://github.com/yevheniidehtiar/gitpm/commit/d7f1043235c18bdf25e543c74fbf27db8a02ff21))

## [0.1.8](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.7...cli-v0.1.8) (2026-04-12)


### Features

* implement Plugin & Extension System epic ([#151](https://github.com/yevheniidehtiar/gitpm/issues/151)) ([86df984](https://github.com/yevheniidehtiar/gitpm/commit/86df9844d5b995527aa036989f305d35f515c36c))


### Bug Fixes

* **sync-github:** validate checkpoint data and surface sync failures in CLI ([23a08ae](https://github.com/yevheniidehtiar/gitpm/commit/23a08aeba581e1b374e04d48ffbb9b0cba09bd21))

## [0.1.7](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.6...cli-v0.1.7) (2026-04-12)


### Bug Fixes

* clean up unreleased changes from PRs [#141](https://github.com/yevheniidehtiar/gitpm/issues/141) and [#144](https://github.com/yevheniidehtiar/gitpm/issues/144) ([d7a9b54](https://github.com/yevheniidehtiar/gitpm/commit/d7a9b54ffbab29ddd5e66fe334afc98e359ea0ae))

## [0.1.6](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.5...cli-v0.1.6) (2026-04-11)


### Features

* **cli:** add 6 agent-optimized commands to reduce tool calls by ~80% ([55bac8b](https://github.com/yevheniidehtiar/gitpm/commit/55bac8b642b71e3e1ae6094e219ff5640d574638))
* **cli:** scaffold Claude Code skill on gitpm init ([65369f1](https://github.com/yevheniidehtiar/gitpm/commit/65369f13d8b252beb6dd0cdbbeab9dc3b7a5d979))


### Bug Fixes

* **cli:** lazy resolveRefs and deduplicate epic/milestone lookup in show ([7733d4e](https://github.com/yevheniidehtiar/gitpm/commit/7733d4e81f84776d67bd80208c0f6dd460a4ec74))
* **cli:** prevent shell injection in commit command ([d2d85f1](https://github.com/yevheniidehtiar/gitpm/commit/d2d85f101566874f4ac6cc309ef3dbbdac59ea11))

## [0.1.5](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.4...cli-v0.1.5) (2026-04-07)


### Features

* add `gitpm quality` command with template-based scoring ([ca4929d](https://github.com/yevheniidehtiar/gitpm/commit/ca4929dba1d54649d1c882be9f10176b82e6840c))


### Bug Fixes

* resolve Biome lint warnings across codebase ([8737c22](https://github.com/yevheniidehtiar/gitpm/commit/8737c227e261548344fccbee1926b8784d8ea74d))

## [0.1.4](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.3...cli-v0.1.4) (2026-04-06)


### Bug Fixes

* adapt codebase for Biome 2.x, TypeScript 6.x, and Vitest 4.x ([ebb5d75](https://github.com/yevheniidehtiar/gitpm/commit/ebb5d75e6580efe1a1ebb6e52be5d9b842d914ab))

## [0.1.3](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.2...cli-v0.1.3) (2026-04-06)


### Bug Fixes

* release workflow tag pattern, npm auth, and changelog cleanup ([23e4055](https://github.com/yevheniidehtiar/gitpm/commit/23e4055871eaedb91e68e9c776f24835f1e1019c))

## [0.1.2](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.1...cli-v0.1.2) (2026-04-06)


### Features

* add comprehensive CLI tests for all 6 commands ([7f49bc9](https://github.com/yevheniidehtiar/gitpm/commit/7f49bc95967f1b8735d20b4b9efffeafde81fa97)), closes [#30](https://github.com/yevheniidehtiar/gitpm/issues/30)
* add GitLab integration package (@gitpm/sync-gitlab) ([f1f1dd8](https://github.com/yevheniidehtiar/gitpm/commit/f1f1dd81148530ca81022397b2b90d1cc0aad12f))
* complete P0 open-source readiness & security hardening epic ([3b49420](https://github.com/yevheniidehtiar/gitpm/commit/3b49420ff85d43a8e86bf9127573562c101aafd4))
* implement @gitpm/cli init & validate commands (Phase 2) ([3659bf9](https://github.com/yevheniidehtiar/gitpm/commit/3659bf9d16218a1519d8b5476051aae187c8620d))
* implement @gitpm/cli sync commands (Phase 5) ([fed8160](https://github.com/yevheniidehtiar/gitpm/commit/fed8160480bf91ff8396396e4f4648828240fb10))
* improve epic-story linkage with fallback heuristics ([#35](https://github.com/yevheniidehtiar/gitpm/issues/35)) ([2d74a9e](https://github.com/yevheniidehtiar/gitpm/commit/2d74a9e5bed3795abf742f05a7faaaacc7985258))
* scaffold monorepo with Bun workspaces (Phase 0) ([cb9dd62](https://github.com/yevheniidehtiar/gitpm/commit/cb9dd62eddf2c1b792918193268b2f688cfb2c10))


### Bug Fixes

* npm publish prep — files field, CLI rename, Trusted Publishing ([ae99c78](https://github.com/yevheniidehtiar/gitpm/commit/ae99c7863afdfb43913247817525999cc943469c))
