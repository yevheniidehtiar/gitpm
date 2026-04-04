# Demo Phase — Generate & Publish Demo Documentation

Generate a rich demo document for a completed GitPM phase, capture real terminal output and code examples, then publish it as a GitHub Gist.

## Usage

Run with: `/demo-phase <phase-number>` (e.g., `/demo-phase 0`, `/demo-phase 1`)

If no phase number is given, generate demos for ALL completed phases.

## Instructions

For the specified phase (or all completed phases), do the following:

### 1. Verify the Phase is Complete

- Run `bun install` if needed
- Run `bun run build` — must succeed
- Run `bun run test` — capture full output
- Run `bun run lint` — capture output
- If the phase is not yet implemented (placeholder code only), report that and stop

### 2. Gather Demo Content

Collect the following for the demo document:

**Phase 0 (Scaffold):**
- Workspace structure (`tree` or file listing)
- `package.json` workspace config
- `tsconfig.json` base config
- `biome.json` config
- Build output (all packages compiling)
- Lint output (passing)

**Phase 1 (Core Schema Engine):**
- Entity schema examples (show a Story/Epic Zod schema with types)
- Fixture tree structure (the `.meta/` directory)
- Sample fixture file content (roadmap YAML, epic markdown with frontmatter)
- Parser demo: show how `parseFile` and `parseTree` work with real fixture data
- Writer demo: show round-trip serialization
- Resolver demo: dependency graph and reference resolution
- Validator demo: show validation passing on valid tree, catching errors on broken tree
- Full test suite output with pass/fail counts
- Build output

**Phase 2 (CLI Init & Validate):**
- `gitpm init` command output in a temp directory
- Generated `.meta/` tree structure
- `gitpm validate` on valid and invalid trees
- CLI help output

**Phase 3 (GitHub Import):**
- Import flow diagram
- Mapper examples (GitHub Issue → Story)
- Sample import output

**Phase 4 (Sync):**
- Bidirectional sync flow
- Diff/conflict detection examples
- Export examples

**Phase 5 (CLI Sync Commands):**
- `gitpm import`, `gitpm push`, `gitpm pull`, `gitpm sync` outputs
- End-to-end workflow demo

**Phase 6 (UI):**
- Screenshots of the web interface (or describe the UI components)
- Route structure
- Component tree

### 3. Generate the Demo Markdown

Create a comprehensive, visually appealing markdown document with:

- **Title**: `GitPM — Phase N Demo: <Phase Name>`
- **Badge-style header** with phase status, test count, build status
- **Table of Contents** with anchor links
- **Architecture section** with ASCII diagrams where relevant
- **Feature walkthrough** — each major feature gets its own section with:
  - Brief description of what it does
  - **Code snippet** showing the implementation (key 10-30 line excerpts)
  - **Terminal output** in fenced code blocks showing it actually working
  - **How to use it** — practical usage instructions
- **Test Results** section with the full test output
- **What's Next** section previewing the next phase

Format all terminal output in fenced code blocks with appropriate language tags.
Use markdown tables, blockquotes, and horizontal rules for visual structure.

### 4. Publish as GitHub Gist

Create a public GitHub Gist with the demo document:

1. Write the demo markdown to `docs/demos/phase-N-demo.md` in the repo
2. Use `curl` with the GitHub API to create a public gist:
   ```bash
   curl -X POST https://api.github.com/gists \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"public": true, "files": {"phase-N-demo.md": {"content": "..."}}}'
   ```
3. If no GitHub token is available, commit the demo file to the repo instead
4. Report the gist URL (or repo file path) to the user

### 5. Update Index

Maintain a `docs/demos/README.md` index file linking to all published demos.

## Output

After completion, report:
- The gist URL(s) where the demo can be viewed
- A summary of what the demo covers
- Test results summary
