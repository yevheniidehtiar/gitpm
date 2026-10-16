---
name: oss-docs
description: Build, restructure and publish a documentation site for an open-source library, CLI or SDK, written for developers as users. Use whenever the user wants a docs site, documentation, a README-to-site conversion, Zensical/MkDocs/Material setup, a getting-started guide, API or CLI reference pages, a docs landing page, a Diataxis information architecture, or to publish docs to GitHub Pages (also alongside a demo app under a sub-path), for a library, CLI, SDK or developer tool, even if they never say "documentation site". Default framework is Zensical (zensical.toml or mkdocs.yml), with an audit script, config/workflow/page templates and a review checklist.
---

# oss-docs

Turn a repository's scattered docs (README, `docs/`, wiki, code comments) into a fast, navigable
documentation site that gets a developer from "what is this?" to a first working result in under
five minutes, and keeps working as the project changes. Default stack: Zensical (successor to
Material for MkDocs), organised with Diataxis, published to GitHub Pages.

## Workflow

Work through these in order; skip a step only when it clearly does not apply.

### a. Audit what exists

Run the audit first so decisions rest on facts, not memory:

```bash
python3 -I <skill>/scripts/audit_docs.py docs --config zensical.toml   # config optional
```

It lists pages (title, H1, words) and flags missing/multiple H1s, orphan pages (not in nav),
broken relative links and anchors, missing images, code fences without a language, unreplaced
`{{placeholders}}`, and pages without an opening paragraph. Exit 1 means blockers. Also read the
README, any wiki export and the CLI's `--help` or public API surface; the code is the source of
truth for reference pages.

### b. Decide the information architecture

Classify every existing page and README section as tutorial, how-to, reference or explanation, then
build a nav of **Home - Getting started - Guides - Reference - Concepts - Contributing**. Read
`references/information-architecture.md` for the mapping table, nav patterns (CLI, library,
SDK with adapters) and page templates. Why: readers arrive with one of four different needs and a
page that mixes them serves none well.

### c. Write the landing page

Start from `assets/index.md`; read `references/landing-page.md` for anatomy. One-sentence value
proposition, install command above the fold, one example with real output, "where next" cards.

### d. Write Getting started, and time it

Start from `assets/getting-started.md` (place it at `docs/getting-started/index.md` or
`quickstart.md`). Actually run every command in a clean shell or container with a stopwatch, paste
real output, and record the measured time and version on the page. If it exceeds five minutes, cut
steps or move them to Guides.

### e. Convert and clean existing pages

- One H1 per page; the first paragraph under it is a one or two sentence summary.
- Replace links with relative links to `.md` files (they survive moves and sub-path hosting; strict
  mode verifies them). No `/absolute` links, no links to GitHub blob paths for pages on the site.
- Every code fence has a language (`bash`, `toml`, `text` for output). Show expected output after
  commands.
- Split mixed pages by type; add troubleshooting tables with real error strings.
- Fix content from the code: run the command, copy the real flags and output.
- Use templates in `assets/page-templates/` for new pages.

### f. Configure Zensical

Copy `assets/zensical.toml`, fill the placeholders, delete unused nav sections. Read
`references/zensical.md` when configuring or debugging (verified CLI, keys, features, extensions,
plugin status, error table). Preview with `uvx zensical serve` (http://localhost:8000); build with
`uvx zensical build --clean --strict`. Keep an existing `mkdocs.yml` if there is one; Zensical reads
it, and moving to TOML is optional.

### g. Publish

Copy `assets/pages.yml` to `.github/workflows/docs.yml` (or `pages.yml` when the same deployment also hosts another artifact such as a demo app) and pin the Zensical version. Set Pages
source to "GitHub Actions" once in repo settings. Read `references/publishing.md` for the
sub-path case (a demo app must coexist at `/repo/demo/`), `site_url` and base path pitfalls,
custom domains, Cloudflare Pages and Netlify. Do not create a PR or push unless the user asked.

### h. Verify

1. Strict build with zero warnings.
2. Audit script exits 0.
3. Read the site once as a newcomer: Home, then Getting started, following it literally.
4. Run through `references/review-checklist.md` before declaring done.

### i. Prevent drift

README = short (what, install, one example, link to the site). Site = long. Link one to the other
and never paste one into the other. Put the preview and audit commands in the Contributing page,
run the strict build in CI on every PR, generate reference content from the source where you can
(`--help`, schemas, docstrings, `--8<--` snippets that include real example files).

## Principles for developers as users

- **Lead with what it does and the install command.** Developers decide in seconds whether to stay.
- **First success in under five minutes.** The motivation to continue is spent on the first screen.
- **Every command copy-pasteable, then followed by expected output.** It lets readers know they are
  on track without guessing; it also exposes docs that drifted from reality.
- **One task per guide.** Pages that answer one question get found by search and stay maintainable.
- **Reference is complete and boring.** Lookup readers want exact facts, not prose or persuasion.
- **Explanation answers "why", not "how".** Mixing the two hides both.
- **No marketing adjectives.** "Fast", "powerful", "seamless" are unverifiable; numbers and
  commands are not.
- **Show failure modes.** A troubleshooting table with literal error text turns support questions
  into search hits.
- **Mention version numbers** (install pins, "added in", tested-with). Docs without versions rot
  silently.
- **Make "Edit this page" visible** (`content.action.edit`). Fixing a typo should take 30 seconds.
- **Keep top-level nav to 7 items or fewer.** More than that is a sitemap, not navigation.

## Anti-patterns to catch

- README pasted verbatim into the site (two sources of truth that drift).
- A "Getting started" that is really a reference (lists options instead of leading to a result).
- A nav that mirrors the repo tree (`packages/core`, `packages/cli`) instead of reader tasks.
- Screenshots of terminals or config instead of copyable text.
- Pages without a first-paragraph summary, or with several H1s.
- Orphan pages that exist but are not in the nav (Zensical does not warn about them).
- Absolute links and unquoted placeholders in front matter that break the build or the sub-path.
- Reference written by hand when it could be generated.

## Where to read next

- `references/zensical.md`: configuring or debugging the build (CLI, `zensical.toml`, features,
  extensions, plugin status, migration, build errors). Facts verified 2026-10-16 on zensical 0.0.71.
- `references/information-architecture.md`: deciding nav and page types; templates.
- `references/landing-page.md`: writing the home page, with grid-card example.
- `references/publishing.md`: GitHub Pages, sub-path demo coexistence, custom domain, Cloudflare,
  Netlify.
- `references/review-checklist.md`: before declaring done.
- `assets/`: `zensical.toml`, `pages.yml`, `index.md`, `getting-started.md`, `page-templates/`.
- `scripts/audit_docs.py`: the audit (`python3 -I scripts/audit_docs.py <docs_dir> [--config FILE]`).

## Output expectations

At the end report: the nav you chose and why, what was converted vs written new, the measured
time-to-first-success, strict build and audit results, the deploy URL (or what is left to enable),
and anything you could not verify.
