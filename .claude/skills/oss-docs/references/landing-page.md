# Developer landing page

A developer arrives with one question: "will this solve my problem, and how fast can I find out?"
The page must answer in one screen without scrolling. The patterns below are widely used on
developer docs sites (Astro, Bun, Tailwind and Stripe docs follow most of them); they are patterns,
not copy to imitate. Compare against current live sites when designing a new page.

## Anatomy, top to bottom

1. **H1 = the project name.** Directly under it, one sentence: what it does, for whom, the one
   differentiator. Concrete nouns and verbs, no "powerful/seamless/modern".
2. **Install block above the fold.** One copy-able command (use tabs if there are several package
   managers; `content.tabs.link` keeps the choice). Include the version if install pins matter.
3. **Primary call to action:** "Get started" button to the 5-minute path; secondary: repository.
4. **Proof in code:** the smallest example that shows the value, followed by its real output.
   A diagram only if the mechanism is the value. Screenshots are a last resort for GUIs.
5. **Three to five concrete capabilities,** each one sentence with a command, number or name.
6. **"Where next" rail:** cards to Getting started, Guides, Reference, Concepts.
7. **Status line:** current version, stability (pre-1.0?), license, link to changelog.

Keep the page under about 150 lines. Everything else lives one click away. Home is not a
second README: do not paste the README in; summarise and link.

## Example (Zensical grid cards; verified to render with `attr_list` + `md_in_html`)

````markdown
---
title: "acme-cli"
hide:
  - toc
---

# acme-cli

Sync a Git repository's task files with GitHub Issues, in both directions, from the terminal.

```bash
npm install -g acme-cli
```

[Get started in 5 minutes](getting-started/index.md){ .md-button .md-button--primary }
[View on GitHub](https://github.com/acme/acme-cli){ .md-button }

## See it work

```bash
acme init && acme sync --dry-run
```

```text
Would create 3 issues, update 1, skip 12 (unchanged)
```

<div class="grid cards" markdown>

-   **Getting started**

    ---

    Install and run a first sync in under five minutes.

    [Start here](getting-started/index.md)

-   **Reference**

    ---

    Every command and option.

    [Open reference](reference/index.md)

</div>
````

If grid cards are unavailable in the chosen theme or builder, use a table:

```markdown
| Start | Do | Look up | Understand |
|---|---|---|---|
| [Getting started](getting-started/index.md) | [Guides](guides/index.md) | [Reference](reference/index.md) | [Concepts](concepts/index.md) |
```

## Other patterns worth copying

- **Time-to-first-success stated on the page** ("about 5 minutes") and actually measured.
- **Versioned install commands** where the version matters (`@1.2`, `==1.2`), and a visible
  "current version" line.
- **Copy buttons** on every command block (`content.code.copy`).
- **"Edit this page"** visible on every page (`content.action.edit`).
- **A next-steps rail** at the end of each page, not just the home page.
- **Honest status:** say what is not supported or is experimental. Developers trust that.

## Landing page smells

- Hero sentence needs the word "platform", "solution" or "ecosystem".
- Install command is below the fold or behind a click.
- Feature list of adjectives with no commands or numbers.
- Logo wall or testimonials before the first code sample.
- Second copy of the README.
