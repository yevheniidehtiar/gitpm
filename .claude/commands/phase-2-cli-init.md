# Phase 2: @gitpm/cli — Init & Validate Commands

Read `CLAUDE.md` for project context and `docs/IMPLEMENTATION_PLAN.md` Phase 2 for detailed tasks.

Depends on: Phase 1 (@gitpm/core must be built and passing tests).

## Execute in order

### Step 1: CLI Framework

Create `packages/cli/src/index.ts`:
- Set up `commander` with program name `gitpm`.
- Add `--version` flag reading from package.json.
- Add global option `--meta-dir <path>` (default: `.meta` relative to cwd).
- Add a shebang line `#!/usr/bin/env node` at the top.
- Register commands from `./commands/` (init, validate for now — leave room for import, push, pull, sync).

### Step 2: `gitpm init` command

Create `packages/cli/src/commands/init.ts`:
- Usage: `gitpm init [project-name]`
- If project-name not provided, prompt interactively using `@inquirer/prompts`.
- Call `scaffoldMeta(metaDir, projectName)` from `@gitpm/core`.
- On success: print the created file tree (use `chalk` for coloring — directories in blue, files in white). Print a summary: "Created X files in .meta/".
- On error: print the error in red and exit with code 1.

### Step 3: `gitpm validate` command

Create `packages/cli/src/commands/validate.ts`:
- Usage: `gitpm validate`
- Call `parseTree(metaDir)` → check for parse errors.
- Call `resolveRefs(tree)` → check for resolution errors.
- Call `validateTree(resolvedTree)` → get validation results.
- Print results:
  - Parse errors: red, with file path and error message.
  - Validation errors: red, with entity ID, file path, error code, message.
  - Validation warnings: yellow, same format.
  - If all clear: green checkmark "✓ .meta/ tree is valid (X entities)".
- Exit code 1 if any errors, 0 if only warnings or clean.

### Step 4: CLI Utility Helpers

Create `packages/cli/src/utils/`:
- `output.ts` — helper functions: `printSuccess(msg)`, `printError(msg)`, `printWarning(msg)`, `printTree(files[])`. Use `chalk` for colors.
- `config.ts` — resolve meta dir from CLI option, handling relative and absolute paths.

### Step 5: Build & Link

- Ensure `tsup` config for cli outputs to `dist/index.js` with the shebang preserved.
- Test with `bun link` to make `gitpm` available as a global command.
- Verify `gitpm --help`, `gitpm --version`, `gitpm init --help`, `gitpm validate --help` all produce correct output.

## Verify

- `gitpm init test-project` creates a valid `.meta/` directory in the current working directory.
- `gitpm validate` passes on the freshly initialized project.
- Manually break a file in `.meta/` (e.g., remove a required field) and verify `gitpm validate` reports the error and exits 1.
- `--meta-dir` flag works to point to a custom directory.
