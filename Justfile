# gitpm — Git-Native Project Management
# Run `just --list` to see available recipes.

set positional-arguments := true

# List available recipes
default:
    @just --list

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

# Install macOS toolchain (bun, biome) via Homebrew
bootstrap:
    brew install oven-sh/bun/bun
    brew install biome
    just install

# Install all workspace dependencies
install:
    bun install

# ---------------------------------------------------------------------------
# Development
# ---------------------------------------------------------------------------

# Start the gitpm UI dev server (API :4747 + Vite frontend)
demo:
    bun run dev:ui

# ---------------------------------------------------------------------------
# Build & Quality
# ---------------------------------------------------------------------------

# Build all packages (tsup for libs/cli, vite for ui)
build:
    bun run build

# Run the full test suite via Vitest
test *args='':
    bun run test {{ args }}

# Lint all files with Biome
lint:
    bun run lint

# Auto-fix lint and formatting issues
fmt:
    bunx biome check --write .

# Pre-push check: lint, build, then test (order matters — tests need dist/)
check:
    bun run lint
    bun run build
    bun run test

# Remove all dist/ and node_modules/.cache directories
clean:
    rm -rf packages/*/dist
    rm -rf node_modules/.cache

# Full reset: clean + reinstall + rebuild
nuke:
    just clean
    rm -rf node_modules packages/*/node_modules
    just install
    just build

# ---------------------------------------------------------------------------
# Release
# ---------------------------------------------------------------------------

# Publish all public packages to npm (requires npm auth)
publish-all: build
    cd packages/core         && npm publish --access public
    cd packages/sync-github  && npm publish --access public
    cd packages/sync-gitlab  && npm publish --access public
    cd packages/sync-jira    && npm publish --access public
    cd packages/cli          && npm publish --access public
    cd packages/ui           && npm publish --access public
