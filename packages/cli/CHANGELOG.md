# Changelog

## [0.1.15](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.14...cli-v0.1.15) (2026-10-21)


### Bug Fixes

* publish with npm trusted publishing and document all five trackers ([#307](https://github.com/yevheniidehtiar/gitpm/issues/307)) ([fe8507a](https://github.com/yevheniidehtiar/gitpm/commit/fe8507ad25c2f363728f003e0abfc68b0d013a80))

## [0.1.14](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.13...cli-v0.1.14) (2026-10-18)


### Features

* **cli:** wire Bitbucket adapter into the CLI and auto-detection ([#299](https://github.com/yevheniidehtiar/gitpm/issues/299)) ([c9a39ec](https://github.com/yevheniidehtiar/gitpm/commit/c9a39ecac5434d091ed59f3a5c06d39df0210aef))


### Bug Fixes

* **cli:** resolve GITLAB_TOKEN, JIRA_TOKEN and JIRA_EMAIL per adapter ([#294](https://github.com/yevheniidehtiar/gitpm/issues/294)) ([104bdbc](https://github.com/yevheniidehtiar/gitpm/commit/104bdbcb0196ed032a10251544b0582703fb3198))

## [0.1.13](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.12...cli-v0.1.13) (2026-10-17)


### Bug Fixes

* **cli:** upgrade to commander 15 and require Node 22.12+ ([#276](https://github.com/yevheniidehtiar/gitpm/issues/276)) ([03c02be](https://github.com/yevheniidehtiar/gitpm/commit/03c02bebc4a33351842aa3d772c925546b212115))

## [0.1.12](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.11...cli-v0.1.12) (2026-10-16)


### Features

* **analytics:** blocked-count rollups, tree-browser progress bars, markdown audit report ([#243](https://github.com/yevheniidehtiar/gitpm/issues/243)) ([58ff4f7](https://github.com/yevheniidehtiar/gitpm/commit/58ff4f7dc0c2b27ed74e1507728bc1903d4553a8))
* **cli:** add context command generating CLAUDE.md project context ([#242](https://github.com/yevheniidehtiar/gitpm/issues/242)) ([2f86b72](https://github.com/yevheniidehtiar/gitpm/commit/2f86b72878fe01009da7d6a2fdf3823eb5fae6f9))
* **sprint:** interactive sprint plan command and points-based capacity tracking ([#244](https://github.com/yevheniidehtiar/gitpm/issues/244)) ([86c9e36](https://github.com/yevheniidehtiar/gitpm/commit/86c9e36c3df6b5ea16f5e6f543d8126faad4a976))
* **sync-linear:** add Linear integration adapter ([#241](https://github.com/yevheniidehtiar/gitpm/issues/241)) ([8e9b7e4](https://github.com/yevheniidehtiar/gitpm/commit/8e9b7e42ae126a557e953f2692f54558caf1cf04))


### Bug Fixes

* **sync:** stop corrupting write paths during pull/sync; add CLI integration tests ([#246](https://github.com/yevheniidehtiar/gitpm/issues/246)) ([460bc09](https://github.com/yevheniidehtiar/gitpm/commit/460bc0939e008eb54171f72f48193baf369254db))

## [0.1.11](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.10...cli-v0.1.11) (2026-04-26)


### Features

* pass adapter result payload into post-* hook context ([460fe1a](https://github.com/yevheniidehtiar/gitpm/commit/460fe1a96109909d86cd9cfb16e0c34c64ae7472))

## [0.1.10](https://github.com/yevheniidehtiar/gitpm/compare/cli-v0.1.9...cli-v0.1.10) (2026-04-26)


### Features

* pass adapter result payload into post-* hook context ([460fe1a](https://github.com/yevheniidehtiar/gitpm/commit/460fe1a96109909d86cd9cfb16e0c34c64ae7472))

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
