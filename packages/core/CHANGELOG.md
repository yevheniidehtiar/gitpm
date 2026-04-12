# Changelog

## [0.1.9](https://github.com/yevheniidehtiar/gitpm/compare/core-v0.1.8...core-v0.1.9) (2026-04-12)


### Bug Fixes

* **core:** address review findings for workspace adapter resolution ([fc2ed99](https://github.com/yevheniidehtiar/gitpm/commit/fc2ed99b17a714a0aeb54e231dc669703d7fb9f0))
* **core:** resolve adapter packages from workspace node_modules in Node.js ([2187cb4](https://github.com/yevheniidehtiar/gitpm/commit/2187cb439b9d927da09c316dc495fe170b44eaeb))

## [0.1.8](https://github.com/yevheniidehtiar/gitpm/compare/core-v0.1.7...core-v0.1.8) (2026-04-12)


### Features

* implement Plugin & Extension System epic ([#151](https://github.com/yevheniidehtiar/gitpm/issues/151)) ([86df984](https://github.com/yevheniidehtiar/gitpm/commit/86df9844d5b995527aa036989f305d35f515c36c))

## [0.1.7](https://github.com/yevheniidehtiar/gitpm/compare/core-v0.1.6...core-v0.1.7) (2026-04-12)


### Bug Fixes

* clean up unreleased changes from PRs [#141](https://github.com/yevheniidehtiar/gitpm/issues/141) and [#144](https://github.com/yevheniidehtiar/gitpm/issues/144) ([d7a9b54](https://github.com/yevheniidehtiar/gitpm/commit/d7a9b54ffbab29ddd5e66fe334afc98e359ea0ae))

## [0.1.6](https://github.com/yevheniidehtiar/gitpm/compare/core-v0.1.5...core-v0.1.6) (2026-04-11)


### Features

* **cli:** add 6 agent-optimized commands to reduce tool calls by ~80% ([55bac8b](https://github.com/yevheniidehtiar/gitpm/commit/55bac8b642b71e3e1ae6094e219ff5640d574638))


### Bug Fixes

* **core:** guard against prototype pollution in setNestedField and applyAssignments ([02293ae](https://github.com/yevheniidehtiar/gitpm/commit/02293aeb8843213c6f1d722ed1c64521ddb6528f))
* **core:** prevent prototype pollution in set-fields assignments ([1f08bb5](https://github.com/yevheniidehtiar/gitpm/commit/1f08bb5293669d911ad095054d111834145b9a28))
* **core:** prevent silent overwrite on duplicate titles in create-entity ([1f81ea9](https://github.com/yevheniidehtiar/gitpm/commit/1f81ea92036c4178d2ecfa032fb5c26a4719efeb))
* **core:** remove implicit number coercion in set-fields coerceValue ([76652b4](https://github.com/yevheniidehtiar/gitpm/commit/76652b42f5212f1ab7bfc9909a9c1f09e9761c0b))
* **core:** remove unused cwd field from FormatOptions ([abc18e3](https://github.com/yevheniidehtiar/gitpm/commit/abc18e3fcd32d60ab04e0a1b213695add72ca5d8))

## [0.1.5](https://github.com/yevheniidehtiar/gitpm/compare/core-v0.1.4...core-v0.1.5) (2026-04-07)


### Features

* add `gitpm quality` command with template-based scoring ([ca4929d](https://github.com/yevheniidehtiar/gitpm/commit/ca4929dba1d54649d1c882be9f10176b82e6840c))


### Bug Fixes

* replace polynomial regex with line-by-line heading extraction ([106fe6f](https://github.com/yevheniidehtiar/gitpm/commit/106fe6fa2e5b69d20cca6f49bc6c034d8b9841cf))
* resolve Biome lint warnings across codebase ([8737c22](https://github.com/yevheniidehtiar/gitpm/commit/8737c227e261548344fccbee1926b8784d8ea74d))

## [0.1.4](https://github.com/yevheniidehtiar/gitpm/compare/core-v0.1.3...core-v0.1.4) (2026-04-06)


### Bug Fixes

* adapt codebase for Biome 2.x, TypeScript 6.x, and Vitest 4.x ([ebb5d75](https://github.com/yevheniidehtiar/gitpm/commit/ebb5d75e6580efe1a1ebb6e52be5d9b842d914ab))

## [0.1.3](https://github.com/yevheniidehtiar/gitpm/compare/core-v0.1.2...core-v0.1.3) (2026-04-06)


### Bug Fixes

* release workflow tag pattern, npm auth, and changelog cleanup ([23e4055](https://github.com/yevheniidehtiar/gitpm/commit/23e4055871eaedb91e68e9c776f24835f1e1019c))

## [0.1.2](https://github.com/yevheniidehtiar/gitpm/compare/core-v0.1.1...core-v0.1.2) (2026-04-06)


### Features

* add @gitpm/sync-jira package for Jira Cloud/Server integration ([e4559c0](https://github.com/yevheniidehtiar/gitpm/commit/e4559c04750c8a707299e5587638510701855534))
* add GitLab integration package (@gitpm/sync-gitlab) ([f1f1dd8](https://github.com/yevheniidehtiar/gitpm/commit/f1f1dd81148530ca81022397b2b90d1cc0aad12f))
* complete P0 open-source readiness & security hardening epic ([3b49420](https://github.com/yevheniidehtiar/gitpm/commit/3b49420ff85d43a8e86bf9127573562c101aafd4))
* implement @gitpm/core schema engine (Phase 1) ([646bff0](https://github.com/yevheniidehtiar/gitpm/commit/646bff0c1a59a6faae7ce926eaa524665301e16c))
* scaffold monorepo with Bun workspaces (Phase 0) ([cb9dd62](https://github.com/yevheniidehtiar/gitpm/commit/cb9dd62eddf2c1b792918193268b2f688cfb2c10))


### Bug Fixes

* npm publish prep — files field, CLI rename, Trusted Publishing ([ae99c78](https://github.com/yevheniidehtiar/gitpm/commit/ae99c7863afdfb43913247817525999cc943469c))
