# Contributing to GitPM

Thank you for your interest in contributing to GitPM! This guide will help you get started.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (latest stable version)
- [Git](https://git-scm.com/)
- Node.js 20+ (for build matrix compatibility)

### Getting Started

```bash
git clone https://github.com/yevheniidehtiar/gitpm.git
cd gitpm
bun install
bun run build
bun run test
```

### Project Structure

GitPM is a monorepo with the following packages:

- `packages/core` — Schema engine (Zod schemas, parser, writer, resolver, validator)
- `packages/sync-github` — GitHub sync adapter
- `packages/sync-gitlab` — GitLab sync adapter
- `packages/sync-jira` — Jira sync adapter
- `packages/cli` — CLI entry point
- `packages/ui` — React web interface

### Useful Commands

```bash
bun install              # Install all dependencies
bun run build            # Build all packages
bun run test             # Run all tests
bun run lint             # Lint with Biome
bun run dev:ui           # Start UI dev server
```

## Code Conventions

- **Language**: TypeScript in strict mode, ESM only
- **Imports**: Use ESM (`import`/`export`), prefer `type` imports where possible
- **File extensions**: Use `.js` in import paths (TypeScript output)
- **Validation**: Use `zod` for all schema validation
- **Error handling**: Return `Result<T, E>` types — no thrown exceptions in library code
- **File I/O**: Use `node:fs/promises` (Bun-compatible)
- **Tests**: Colocated as `*.test.ts` next to source files
- **Style**: No classes unless genuinely needed — prefer functions and plain objects
- **Formatting**: 2-space indentation, single quotes (enforced by Biome)

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feat/description` for new features
- `fix/description` for bug fixes
- `docs/description` for documentation

### Commit Messages

Write clear, concise commit messages that explain **why** the change was made:
- `feat: add kanban board view with drag-and-drop`
- `fix: prevent XSS in markdown preview component`
- `docs: add CONTRIBUTING.md with development guide`

### Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes with tests
3. Run the pre-push checklist:
   ```bash
   bun run lint && bun run build && bun run test
   ```
4. Open a PR with a clear description of the change
5. Ensure CI checks pass
6. Wait for maintainer review

### PR Requirements

- All tests must pass
- Linting must pass (Biome)
- New features should include tests
- Breaking changes should be clearly documented

## Project Management

GitPM uses itself for project management. The `.meta/` directory is the source of truth for all roadmap items, epics, and stories. When contributing:

- Check `.meta/epics/` for available work items
- Reference issue numbers in commits and PRs
- Update `.meta/` files if your change affects project status

## Reporting Issues

- **Bugs**: Open a GitHub issue with reproduction steps
- **Features**: Open a GitHub issue describing the use case
- **Security**: See [SECURITY.md](SECURITY.md) — do NOT open public issues for vulnerabilities

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.
