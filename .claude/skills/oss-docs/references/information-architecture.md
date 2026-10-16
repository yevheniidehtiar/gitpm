# Information architecture for developer docs

Based on Diátaxis (https://diataxis.fr): documentation serves four distinct needs, and mixing them
in one page is the root cause of most bad docs. Each need has its own form.

## The four types

| | Tutorial | How-to guide | Reference | Explanation |
|---|---|---|---|---|
| Reader is | learning, new | working, has a goal | working, needs a fact | studying, wants understanding |
| Answers | "Can you teach me?" | "How do I do X?" | "What exactly is X?" | "Why is it like this?" |
| Form | a lesson with guaranteed result | steps to a goal | neutral description | discussion, context, trade-offs |
| Tone | "we will..." | imperative | declarative, boring | reflective |
| Never includes | options, theory | teaching, completeness | opinion, narrative | step-by-step instructions |

Compass when classifying a page: does it inform **action** (tutorial, how-to) or **cognition**
(reference, explanation)? Does it serve **study** (tutorial, explanation) or **work** (how-to,
reference)? If a paragraph belongs to a different quadrant, move it out and link to it.

## Mapping a library's material onto the nav

| Source material | Goes to |
|---|---|
| README install + hello world | Home (short) and Getting started |
| "Quick start" / "Usage" sections | Getting started (tutorial) |
| FAQ entries, recipes, "how do I..." | Guides (one task per page) |
| CLI `--help`, config options, API signatures, schema/entity fields | Reference (generate where possible) |
| Architecture docs, design notes, ADRs, "why not X" | Concepts |
| CONTRIBUTING, dev setup, release process | Contributing |
| Changelog | link to GitHub releases or `CHANGELOG.md`; do not rewrite |
| Marketing / pitch pages | Home, kept to one screen; anything else is Concepts |

## Standard top-level nav (keep to 7 or fewer)

Home · Getting started · Guides · Reference · Concepts · Contributing (+ optionally Changelog link)

Order follows the reader's journey (try, do, look up, understand, contribute), not the repo tree.
Section titles are nouns the reader would search for. Each section has an `index.md` that says what
is in it and in what order to read.

## Patterns by project type

**CLI tool**

- Getting started: install, first command, expected output.
- Guides: one per real task ("Sync on a schedule", "Use in CI").
- Reference: Commands (one page, or one page per command group), Configuration file, Environment
  variables, Exit codes.
- Concepts: how the tool models its data, what it will and will not do.

**Library (single language)**

- Getting started: install, 10-line example, run it.
- Guides: integrate with framework X, handle errors, testing, performance tuning.
- Reference: API (generated from docstrings/types where possible), Configuration, Errors, Types.
- Concepts: architecture, concurrency model, versioning and stability policy.

**SDK or core + adapters (e.g. core, GitHub adapter, GitLab adapter, UI)**

- Do not give each package its own top-level nav item. Put the shared story first.
- Getting started: pick path by need (one install page with tabs per adapter).
- Guides: grouped by task, with tabs for adapter-specific variants.
- Reference: a `Packages` or `Adapters` section with one page per package (install, exports,
  config, limits), plus shared Schema/API pages.
- Concepts: the adapter contract, data flow between core and adapters, mapping tables.

**Tool with a hosted demo/app:** link the demo from Home and Getting started ("Try it without
installing"); keep it out of nav as an external link or place it under a sub-path (see publishing).

## Page templates

Copy from `assets/page-templates/`. What each contains:

- **Tutorial**: promise ("you will build X, N minutes") · prerequisites · numbered steps each
  ending in a visible check · recap · next steps. No choices, no side trips.
- **How-to**: goal sentence · prerequisites · numbered steps · variations · troubleshooting ·
  related links. Title starts with "How to" or a verb. One task only.
- **Reference**: one-line summary and version · synopsis · arguments/options tables (type,
  default, description) · examples · errors/exit codes · see also. Structure mirrors the code.
- **Explanation**: the question and short answer · background · mental model (diagram) · trade-offs
  and alternatives · related. Titles like "How X works" or "Why X".

## Rules that keep the structure healthy

- A page has one type. If a how-to grows a paragraph of theory, move it to Concepts and link.
- Link across types instead of copying: tutorial -> how-to -> reference, and concepts <-> all.
- Every page begins with a one or two sentence summary under the H1 (search snippets, skimmers).
- Name pages for the reader's goal, not the code module.
- Generated reference beats hand-written reference: CLI `--help`, JSON Schema, docstrings. Hand
  written reference rots first.
