# Review checklist (about 10 minutes)

Run before declaring a docs site done. Tick each line or fix it.

## Mechanical (2 min)

- [ ] `python3 -I scripts/audit_docs.py docs --config zensical.toml` exits 0; warnings reviewed.
- [ ] `uvx zensical@<ver> build --clean --strict` prints "No issues found".
- [ ] No unreplaced `{{PLACEHOLDER}}` anywhere (the audit warns about them).
- [ ] `site_url` is the real final URL, including `/repo/` for project pages.
- [ ] CI builds the site on PRs with `--strict`; deploy runs on the default branch only.
- [ ] Pinned Zensical version in CI matches the one used locally.

## First impression (2 min)

- [ ] Home states what it does in one sentence, with no marketing adjectives.
- [ ] Install command is visible without scrolling and is copy-pasteable.
- [ ] One code example plus its real output on Home.
- [ ] A clear "Get started" button; version and status shown.

## Read as a newcomer (4 min)

- [ ] Followed Getting started on a clean shell or container. Every command worked as written.
- [ ] Time to first success was measured and is below 5 minutes (stated on the page).
- [ ] Every command block shows expected output or a way to verify.
- [ ] Prerequisites list versions; there is a troubleshooting section with real error strings.
- [ ] Each page starts with a one or two sentence summary under a single H1.
- [ ] No page mixes types (tutorial with reference tables, how-to with theory).
- [ ] Guides each answer one task and are named for it.
- [ ] Reference is complete (all commands, flags, config keys) and matches the code or `--help`.
- [ ] Concepts explain why, not how.

## Structure and navigation (1 min)

- [ ] Top-level nav has 7 or fewer items; order follows the reader's journey, not the repo tree.
- [ ] Every page is in the nav or intentionally excluded; no orphans.
- [ ] Section index pages explain what is inside and in what order to read.
- [ ] "Edit this page" appears and opens the correct file on the correct branch.
- [ ] Search finds a command name and an error message.

## Drift control (1 min)

- [ ] README is short (what, install, 1 example, link to docs) and links to the site.
- [ ] The site links back to the repo; neither duplicates the other verbatim.
- [ ] Version numbers appear where they matter and have one source of truth.
- [ ] Old doc locations (`docs/*.md` referenced from elsewhere, wiki) either redirect or are removed,
      and in-repo links to moved files are updated.
- [ ] Contributing page says how to preview docs locally (`uvx zensical serve`) and run the audit.
