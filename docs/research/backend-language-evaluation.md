# Backend Language Evaluation for GitPM

**Date**: 2026-04-12
**Status**: Research / RFC
**Author**: AI-assisted analysis

## Motivation

GitPM's backend (`packages/core`, `packages/sync-github`, `packages/cli`) is currently written in TypeScript running on Bun. While functional, the question is whether a different language would be a better fit for the backend workload: heavy file I/O across many small files, in-memory graph operations, YAML/frontmatter parsing, field-level diffing, and GitHub API integration.

This document evaluates six candidate languages against the actual workload characteristics of the codebase.

---

## Current Workload Profile

Analysis of the existing ~11,000 LOC across the three backend packages:

| Aspect | Characteristic | Scale |
|---|---|---|
| File I/O | Read/write hundreds of small markdown+YAML files individually | HIGH |
| In-memory data | Entity lookup maps, adjacency-list dependency graph, topological sort | MODERATE-HIGH |
| String/text processing | YAML parsing, frontmatter extraction, slug generation, field assignment parsing | MODERATE |
| Network I/O | Per-entity GitHub API calls with rate limiting and pagination | HIGH (sync only) |
| Computation | DFS cycle detection, topological sort, field-level diffing, SHA256 hashing | LOW-MODERATE |
| Concurrency need | File reads are sequential today; API calls are sequential with checkpointing | HIGH (opportunity) |

**Key dependencies currently leveraged** (JS/TS ecosystem): `zod` (schema validation), `gray-matter` (frontmatter), `yaml` (serialization), `@octokit/rest` (GitHub API), `commander` (CLI), `chalk`/`ora` (terminal UX), `@inquirer/prompts` (interactive prompts).

**Performance bottlenecks today**:
1. Sequential file I/O (no parallel reads)
2. GitHub API rate limiting (inherent, not language-dependent)
3. Node/Bun startup overhead for CLI invocations

---

## Language Evaluation

### 1. Rust

**Ecosystem fit**

| Capability | Library | Maturity |
|---|---|---|
| YAML parsing | `serde_yml` (fork of deprecated `serde_yaml`), `serde-saphyr` | Good but fragmented after `serde_yaml` deprecation |
| Frontmatter parsing | `gray_matter` (direct port of the JS library) | Good |
| Markdown parsing | `comrak` (GFM), `pulldown-cmark` (CommonMark) | Excellent (`comrak` used by GitHub) |
| GitHub API | `octocrab` (v0.44+) | Good. Typed, async, builder pattern. Covers issues, milestones, PRs |
| CLI framework | `clap` v4 (derive macros) | Excellent. Industry standard |
| Terminal UX | `indicatif` (spinners/progress), `console` (colors) | Excellent |
| Cross-platform binary | `cargo build --target`, `cross`, `cargo-dist` | Very good. Static musl linking for Linux |

**Performance**: Near-optimal file I/O, zero-cost abstractions, no GC. `rayon` for trivial data parallelism (parallel file reads). ~5ms startup time. Memory usage minimal for entity graphs of any realistic project size.

**Type system**: Strictly more expressive than TypeScript. Native `Result<T, E>` with `?` operator is cleaner than the manual `{ ok, value/error }` pattern GitPM uses today. `serde` + derive macros replicate Zod-like parse-and-validate, though with more boilerplate. Algebraic enums model entity types naturally.

**Error handling**: Native `Result<T, E>` with `?` operator, `thiserror` for library errors, `anyhow` for application errors. A direct upgrade over the current manual Result pattern.

**Integration with React UI**: Separate binary, communicates via `.meta/` file tree (already the architecture). `ts-rs` or `typeshare` auto-generate TypeScript types from Rust structs. Can distribute via npm using platform-specific optional dependencies (same pattern Biome uses).

**Learning curve**: **High (2-4 months)**. Ownership, borrowing, lifetimes are genuinely difficult coming from TypeScript.

**Real-world precedent**: `ripgrep`, `bat`, `fd`, `delta`, `starship`, `biome` (this project's own linter). The modern CLI tool ecosystem is substantially Rust.

---

### 2. Go

**Ecosystem fit**

| Capability | Library | Maturity |
|---|---|---|
| YAML parsing | `gopkg.in/yaml.v3`, `goccy/go-yaml` | Excellent. Battle-tested |
| Frontmatter parsing | `adrg/frontmatter` (YAML/JSON/TOML) | Good |
| Markdown parsing | `goldmark` (CommonMark + extensions) | Excellent. Used by Hugo |
| GitHub API | `google/go-github` (REST), `shurcooL/githubv4` (GraphQL) | Excellent. Google-maintained, comprehensive |
| CLI framework | `cobra` + `viper` | Excellent. Used by `kubectl`, `helm`, `gh`, `docker` |
| Terminal UX | Charmbracelet: `bubbletea`, `lipgloss`, `bubbles` | Best-in-class. Unmatched TUI ecosystem |
| Cross-platform binary | `GOOS`/`GOARCH`, `goreleaser` | Excellent. `goreleaser` automates everything |

**Performance**: Very good file I/O. Goroutines make concurrent file reading trivial (no library needed). ~5-10ms startup. GC introduces minor overhead but irrelevant at this scale. Memory ~2-5x vs Rust for same structures.

**Type system**: Weaker than TypeScript in some ways. No union types, limited generics (since 1.18), no pattern matching. Struct tags for validation (`go-playground/validator`, `ozzo-validation`) are less expressive than Zod. This is the main trade-off.

**Error handling**: `(T, error)` return tuple with `if err != nil` everywhere. Explicit but verbose. No `?` operator equivalent. Community Result types exist but aren't idiomatic Go.

**Integration with React UI**: Separate binary. No direct type sharing; use OpenAPI or JSON Schema as contract. Distribute via Homebrew, GitHub Releases, or npm wrapper.

**Learning curve**: **Low (2-4 weeks)**. Go is deliberately simple. Main adjustment is verbosity and weaker types.

**Real-world precedent**: `gh` (GitHub CLI), `kubectl`, `helm`, `terraform`, `hugo`, `lazygit`, `fzf`. Hugo is especially relevant — it does heavy file I/O, YAML/frontmatter parsing, and markdown processing. Almost identical workload to GitPM.

---

### 3. Zig

**Ecosystem fit**

| Capability | Library | Maturity |
|---|---|---|
| YAML parsing | `zig-yaml` (v0.1.1, "frequent breaking changes") | **Immature** |
| Frontmatter parsing | None | **Non-existent** |
| Markdown parsing | `koino` | Niche |
| GitHub API | None | **Non-existent** |
| CLI framework | `cova`, `zig-cli` | Early-stage |
| Terminal UX | Minimal | **Minimal** |
| Cross-platform binary | Built-in cross-compilation | Best-in-class (tiny binaries) |

**Performance**: On par with Rust/C. Zero runtime overhead, manual allocation with explicit allocators. Produces the smallest binaries (~sub-10KB for simple programs). Best cross-compilation story of any language.

**Type system**: Powerful comptime generics, error unions (`!T`) with forced handling. No algebraic data types. Expressing complex domain types (Zod schemas) would be very manual.

**Learning curve**: **Very high**. Manual memory management without Rust's borrow checker safety net. Comptime is alien coming from TypeScript.

**Real-world precedent**: `bun` (the JS runtime GitPM currently uses). Very few developer CLI tools.

**Verdict**: **Not recommended.** Ecosystem gaps are too large. You'd spend months building YAML parsing, frontmatter handling, and GitHub API integration that exist as mature libraries in Rust/Go. Zig excels at runtimes and systems programming, not application-level tools.

---

### 4. Elixir

**Ecosystem fit**

| Capability | Library | Maturity |
|---|---|---|
| YAML parsing | `yaml_elixir` (v2.12+) | Good |
| Frontmatter parsing | None dedicated | Manual split on `---` delimiters |
| Markdown parsing | `earmark` | Good |
| GitHub API | `tentacat` (v2.5) | Adequate but less comprehensive |
| CLI framework | `OptionParser` (stdlib) | Weak. No Cobra/Clap equivalent |
| Terminal UX | `Owl` | Decent but immature |
| Binary distribution | `escript`, `Burrito` | **Problematic** (BEAM dependency or 50MB+ archives) |

**Performance**: BEAM VM startup is 100-500ms — unacceptable for a CLI tool that should feel instant. Concurrent I/O via lightweight processes is excellent but overkill here. Higher memory overhead than compiled languages.

**Error handling**: `{:ok, value}` / `{:error, reason}` tuples with pattern matching. Idiomatically clean and conceptually similar to the current Result pattern.

**Learning curve**: **Medium-high**. Functional paradigm shift: pattern matching, immutability, recursion, process-based concurrency.

**Real-world precedent**: Elixir's strength is web services (Phoenix), not CLI tools. No widely-known CLI tools exist in Elixir.

**Verdict**: **Not recommended.** BEAM VM startup time and binary distribution are fundamental blockers for a CLI tool. Architecturally mismatched for this use case.

---

### 5. OCaml

**Ecosystem fit**

| Capability | Library | Maturity |
|---|---|---|
| YAML parsing | `ocaml-yaml` (C binding), `yamlx` (pure OCaml, YAML 1.2) | Improving |
| Frontmatter parsing | `frontmatter_extractor` | Niche, low usage |
| Markdown parsing | `omd` (GFM-compatible) | Good |
| GitHub API | None dedicated | **Weak** — build HTTP layer manually |
| CLI framework | `cmdliner` v2 | Good. POSIX-compliant, auto man pages |
| Terminal UX | `progress` (progress bars) | **Weak** |
| Cross-platform binary | Native compilation | Good on Linux/macOS, experimental on Windows |

**Type system**: **Best on this list.** Hindley-Milner inference, algebraic data types, exhaustive pattern matching. Native `Result.t`. Variants directly model GitPM's entity types. `let*` binding operators provide monadic chaining like Rust's `?`.

**Unique advantage**: Melange (OCaml-to-JS compiler) could share types between OCaml backend and the React frontend — the only language here with a path to true full-stack type sharing without code generation.

**Learning curve**: **High (2-3 months)**. ML-family syntax is unfamiliar. Functors and modules are advanced concepts.

**Real-world precedent**: `flow` (Facebook's JS type checker), `infer` (static analyzer), `semgrep` (core engine). Serious tools, but developer infrastructure / compilers, not user-facing CLI tools.

**Verdict**: **Interesting but impractical.** Best type system for the domain, but ecosystem gaps in CLI UX, GitHub API, and Windows distribution are real. Only viable if the team already knows OCaml or is willing to make a multi-month investment.

---

### 6. Python (baseline)

**Ecosystem fit**

| Capability | Library | Maturity |
|---|---|---|
| YAML parsing | `ruamel.yaml` (YAML 1.2, round-trip preserving) | Excellent. Preserves comments/formatting |
| Frontmatter parsing | `python-frontmatter` | Excellent. Direct `gray-matter` equivalent |
| Markdown parsing | `markdown-it-py`, `mistune` | Excellent |
| GitHub API | `PyGithub` | Excellent. Most comprehensive Python GitHub client |
| CLI framework | `typer` (type-hint driven, built on `click`) | Excellent |
| Terminal UX | `rich` | Best-in-class across any language |
| Binary distribution | `PyInstaller`, `Nuitka` | **Mediocre** (30-100MB bundles, fragile) |

**Performance**: Adequate for this scale but worst of all candidates. Startup is 200-400ms with import chains. GIL limits parallelism. Memory overhead highest.

**Type system**: `Pydantic` v2 is the closest Zod equivalent (runtime validation + type inference + JSON Schema generation). `mypy`/`pyright` for static analysis. No native `Result` convention — uses exceptions.

**Learning curve**: **Lowest (days)**. Any TypeScript developer can write Python immediately.

**Unique advantage**: `ruamel.yaml` preserves comments and formatting during round-trips — valuable for `.meta/` files that humans edit. No other language has an equivalent.

**Verdict**: **Best libraries, worst distribution.** The startup time and packaging story are dealbreakers for a CLI tool. Would only make sense if GitPM became a server component rather than a local CLI.

---

## Comparison Matrix

| Criterion | Rust | Go | Zig | Elixir | OCaml | Python |
|---|---|---|---|---|---|---|
| YAML ecosystem | Good | Excellent | Poor | Good | Improving | Excellent |
| Frontmatter parsing | Good | Good | None | Weak | Niche | Excellent |
| GitHub API client | Good | Excellent | None | Adequate | None | Excellent |
| CLI framework | Excellent | Excellent | Early | Weak | Good | Excellent |
| Terminal UX | Excellent | Best | Minimal | Decent | Weak | Best |
| Binary distribution | Excellent | Best | Excellent | Bad | Difficult | Bad |
| Startup time | ~5ms | ~5-10ms | ~1-3ms | ~100-500ms | ~10-20ms | ~200-400ms |
| File I/O performance | Excellent | Very good | Excellent | Adequate | Good | Adequate |
| Memory efficiency | Best | Good | Best | Poor | Good | Poor |
| Type system | Excellent | Weak | Moderate | Weak | Best | Weak |
| Error handling (Result) | Native | Verbose | Good | Good | Native | Exceptions |
| Zod equivalent | serde + validator | ozzo-validation | Manual | Ecto changesets | Custom decoders | Pydantic v2 |
| TS type sharing | Good (ts-rs) | Manual | None | None | Possible (Melange) | Indirect |
| Learning curve | High (2-4mo) | Low (2-4wk) | Very high | Medium-high | High (2-3mo) | Lowest |
| CLI precedent | Excellent | Excellent | Minimal | None | Niche | Declining |

---

## Recommendations

### Tier 1: Viable candidates

**Go — Best pragmatic choice**

The `gh` CLI is literal proof that Go is the right tool for "CLI that talks to GitHub + reads/writes local files." Hugo demonstrates Go handling the exact same workload as GitPM (YAML frontmatter + markdown + file tree operations). The Charmbracelet ecosystem gives the best terminal UX of any language. `goreleaser` makes cross-platform distribution zero-effort. The learning curve from TypeScript is gentle (2-4 weeks).

*Trade-off*: The type system is a meaningful downgrade from TypeScript + Zod. No union types, no expressive validation DSL, verbose `if err != nil` error handling. You lose the expressiveness that makes the current schema engine elegant.

**Rust — Best long-term investment**

If the team is willing to invest in the learning curve, Rust gives the best performance, a more expressive type system than TypeScript (native `Result<T, E>`, algebraic enums), and an excellent CLI ecosystem. The `gray_matter` crate is a direct port of the JS library already in use. Distribution via `cargo-dist` + npm wrapper packages is proven (Biome does this). The current `Result<T, E>` pattern in the codebase is already Rust-idiomatic.

*Trade-off*: 2-4 month learning curve. Fragmented YAML ecosystem after `serde_yaml` deprecation. Dual build system with the React UI.

### Tier 2: Conditional

**OCaml** — Only if the team has ML-family experience. Best type system for this domain, and Melange offers unique full-stack type sharing. But ecosystem gaps in CLI UX and distribution are real.

### Tier 3: Not recommended for this use case

- **Zig** — Ecosystem too immature. Would require building fundamental libraries from scratch.
- **Elixir** — BEAM startup time and distribution are architectural mismatches for CLI tools.
- **Python** — Best library ecosystem but startup time and binary distribution are dealbreakers.

### The "do nothing" option

TypeScript on Bun is not a bad choice. The current pain points (startup time, sequential I/O) can be partially addressed without a rewrite:
- Parallel file reads with `Promise.all` + `readFile`
- Bun's native file I/O is already faster than Node's
- `bun build --compile` produces a standalone binary (~50MB, but works)

A rewrite only makes sense if: (a) the team wants to distribute a lean single binary, (b) startup latency matters enough to justify the migration cost, or (c) the project is growing to a scale where TypeScript's runtime overhead becomes noticeable.

---

## Migration Strategy (if proceeding)

Regardless of language choice, a phased approach is recommended:

1. **Phase 1 — Core schemas + parser** (lowest risk). Port `packages/core` to the new language. The file tree is the interface, so the React UI doesn't need to change.
2. **Phase 2 — CLI** (medium risk). Port `packages/cli` to consume the new core library. This is where startup time and binary distribution improve.
3. **Phase 3 — Sync engine** (highest risk). Port `packages/sync-github` last. The GitHub API integration has the most external dependencies and the most complex state management.
4. **Keep `packages/ui` in TypeScript/React** throughout. If using Rust, generate TS types via `ts-rs`. If using Go, define a JSON Schema contract.

Each phase can be shipped independently since the `.meta/` file tree is the integration boundary.

---

## Open Questions

1. How important is single-binary distribution vs the current `bun`-based approach?
2. Is the team willing to invest 2-4 months in Rust, or is the 2-4 week Go ramp-up more realistic?
3. Should the UI eventually move to a desktop app (Tauri = Rust, Wails = Go)?
4. Is there a performance ceiling we're hitting today, or is this primarily about architectural fit?
