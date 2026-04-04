# Phase 1: @gitpm/core — Schema Engine

Read `CLAUDE.md` for project context, `docs/IMPLEMENTATION_PLAN.md` Phase 1, and `docs/schemas/ENTITY_SCHEMAS.md` for the complete schema spec.

## Execute in order

### Step 1: Zod Schemas

Create `packages/core/src/schemas/` with these files:

- `common.ts` — `EntityId`, `Status`, `Priority`, `EntityRef`, `GitHubSync` schemas and types. Use `z.enum` for Status and Priority. Use `z.object` for EntityRef and GitHubSync. Export both schemas and inferred types.
- `story.ts` — Full Story schema with all fields from ENTITY_SCHEMAS.md. Frontmatter schema and full entity schema (frontmatter + body + filePath).
- `epic.ts` — Epic schema. Same pattern.
- `milestone.ts` — Milestone schema.
- `roadmap.ts` — Roadmap schema (YAML-only, no body).
- `prd.ts` — PRD schema.
- `index.ts` — Re-export everything. Also export a `ParsedEntity` discriminated union: `Story | Epic | Milestone | Roadmap | PRD`, discriminated on the `type` field.

Write tests: `packages/core/src/schemas/__tests__/schemas.test.ts`. Test that valid data parses correctly and invalid data produces clear Zod errors. At least 2 tests per entity type.

### Step 2: Fixtures

Create `packages/core/src/__fixtures__/valid-tree/` — a complete `.meta/` directory with:
- `roadmap/roadmap.yaml` with 1 roadmap and 2 milestone refs
- `roadmap/milestones/q2-launch.md` and `q3-scale.md`
- `epics/balancing-engine/epic.md` with 2 stories under `stories/`
- `stories/setup-ci.md` (orphan story)
- `prds/balancing-v1/prd.md`

All entities must have valid IDs and cross-references. Also create `packages/core/src/__fixtures__/broken-tree/` with intentional errors (orphaned ref, missing required field, duplicate ID).

### Step 3: Parser

Create `packages/core/src/parser/`:

- `types.ts` — `MetaTree` type (collections of each entity type + errors array), `ParseError` type.
- `parse-file.ts` — `parseFile(filePath: string): Promise<Result<ParsedEntity>>`. Use `gray-matter` to split frontmatter from body. Read `type` field to determine which Zod schema to validate against. Attach `filePath` and `body` to the result.
- `parse-tree.ts` — `parseTree(metaDir: string): Promise<Result<MetaTree>>`. Recursively glob `**/*.md` and `**/*.yaml` under metaDir. Call `parseFile` on each. Sort results into the MetaTree collections. Collect parse errors without failing the entire tree.

Write tests using the fixture trees. Verify the valid tree parses completely. Verify the broken tree parses partially and returns appropriate errors.

### Step 4: Writer

Create `packages/core/src/writer/`:

- `write-file.ts` — `writeFile(entity: ParsedEntity, filePath: string): Promise<Result<void>>`. Serialize frontmatter with `yaml`, join with body using `---` delimiters. Preserve unknown frontmatter fields.
- `write-tree.ts` — `writeTree(tree: MetaTree, metaDir: string): Promise<Result<void>>`. Create directories as needed. Write each entity to its filePath.
- `scaffold.ts` — `scaffoldMeta(metaDir: string, projectName: string): Promise<Result<void>>`. Create the full `.meta/` directory structure with sample content. Generate IDs with `nanoid(12)`. Include all required directories and at minimum: 1 roadmap, 1 milestone, 1 epic with 1 story.
- `slug.ts` — `toSlug(title: string): string`. Implement the slug generation rules from ENTITY_SCHEMAS.md.

Write round-trip tests: parse fixture → write to temp dir → parse again → deep-equal comparison. Must be lossless.

### Step 5: Resolver

Create `packages/core/src/resolver/`:

- `resolve.ts` — `resolveRefs(tree: MetaTree): Result<ResolvedTree>`. Walk all entities. For each `EntityRef`, find the target entity by ID across all collections. Populate reverse references: epic.stories, milestone.epics, roadmap.milestones (resolved). Return `ResolvedTree` (same shape as MetaTree but with resolved ref fields populated). Report unresolved refs as errors.
- `graph.ts` — `buildDependencyGraph(tree: ResolvedTree): DependencyGraph`. Build adjacency list. Implement `topologicalSort(): EntityId[]` and `findCycles(): EntityId[][]`.

Write tests: valid refs resolve correctly, broken refs reported, cycles detected.

### Step 6: Validator

Create `packages/core/src/validator/`:

- `validate.ts` — `validateTree(tree: ResolvedTree): ValidationResult`. Rules: no orphaned refs, no duplicate IDs, no cycles, status consistency (epic not `done` if any story is `in_progress`), required fields present.
- `types.ts` — `ValidationResult`, `ValidationError`, `ValidationWarning` types. Each error/warning includes entity ID, file path, error code, and human-readable message.

Write tests for each validation rule.

### Step 7: Public API

Create `packages/core/src/index.ts` — clean re-export of all public functions and types.

## Verify

- `bun run test --filter core` passes all tests (target: 30+ tests)
- The fixture valid-tree parses, resolves, and validates without errors
- The fixture broken-tree produces the expected errors
- Round-trip parse→write→parse is lossless
