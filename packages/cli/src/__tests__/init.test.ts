import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockScaffoldMeta = vi.fn();
const mockInput = vi.fn();

vi.mock('@gitpm/core', () => ({
  scaffoldMeta: (...args: unknown[]) => mockScaffoldMeta(...args),
}));

vi.mock('@inquirer/prompts', () => ({
  input: (...args: unknown[]) => mockInput(...args),
}));

let _logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

async function run(...args: string[]) {
  const { initCommand } = await import('../commands/init.js');
  const program = new Command();
  program.option('--meta-dir <path>', 'Path to .meta directory', '.meta');
  program.addCommand(initCommand);
  await program.parseAsync(['node', 'gitpm', 'init', ...args]);
}

/**
 * The real scaffoldMeta is mocked to a no-op, so tests must create the
 * .meta directory themselves (collectFiles reads it, and the skill
 * scaffolder treats dirname(metaDir) as the project root).
 */
async function seedMetaDir(metaDir: string): Promise<void> {
  await mkdir(metaDir, { recursive: true });
  await writeFile(join(metaDir, 'roadmap.yaml'), '');
}

// --- Tests ---

describe('gitpm init', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-cli-init-'));
    _logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates .meta structure with project name argument', async () => {
    const metaDir = join(tmpDir, '.meta');
    mockScaffoldMeta.mockResolvedValue({ ok: true, value: undefined });

    // scaffoldMeta is mocked, so collectFiles will read from an empty dir.
    // We need to create at least one file so the readdir doesn't fail.
    await seedMetaDir(metaDir);

    await run('my-project', '--meta-dir', metaDir);

    expect(mockScaffoldMeta).toHaveBeenCalledWith(metaDir, 'my-project');
    expect(mockInput).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prompts for project name when not provided', async () => {
    const metaDir = join(tmpDir, '.meta');
    mockInput.mockResolvedValue('prompted-name');
    mockScaffoldMeta.mockResolvedValue({ ok: true, value: undefined });

    await seedMetaDir(metaDir);

    await run('--meta-dir', metaDir);

    expect(mockInput).toHaveBeenCalled();
    expect(mockScaffoldMeta).toHaveBeenCalledWith(metaDir, 'prompted-name');
  });

  it('exits with code 1 when scaffoldMeta fails', async () => {
    const metaDir = join(tmpDir, '.meta');
    mockScaffoldMeta.mockResolvedValue({
      ok: false,
      error: { message: 'directory already exists' },
    });

    await expect(run('my-project', '--meta-dir', metaDir)).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('directory already exists');
  });

  it('respects --meta-dir option', async () => {
    const customDir = join(tmpDir, 'custom-meta');
    mockScaffoldMeta.mockResolvedValue({ ok: true, value: undefined });

    await seedMetaDir(customDir);

    await run('test-proj', '--meta-dir', customDir);

    expect(mockScaffoldMeta).toHaveBeenCalledWith(customDir, 'test-proj');
  });

  describe('Claude Code skill scaffolding', () => {
    it('writes the skill into .claude/skills/gitpm/ by default', async () => {
      const metaDir = join(tmpDir, '.meta');
      mockScaffoldMeta.mockResolvedValue({ ok: true, value: undefined });
      await seedMetaDir(metaDir);

      await run('my-project', '--meta-dir', metaDir);

      const skillPath = join(tmpDir, '.claude', 'skills', 'gitpm', 'SKILL.md');
      const body = await readFile(skillPath, 'utf-8');

      // Frontmatter matches what Claude Code expects for skill discovery
      expect(body).toMatch(/^---\nname: gitpm\ndescription: /);
      // Teaches the 6 commands the skill is meant to promote
      expect(body).toContain('gitpm query');
      expect(body).toContain('gitpm show');
      expect(body).toContain('gitpm set');
      expect(body).toContain('gitpm create');
      expect(body).toContain('gitpm move');
      expect(body).toContain('gitpm commit');
    });

    it('skips the skill when --no-claude-skill is passed', async () => {
      const metaDir = join(tmpDir, '.meta');
      mockScaffoldMeta.mockResolvedValue({ ok: true, value: undefined });
      await seedMetaDir(metaDir);

      await run('my-project', '--meta-dir', metaDir, '--no-claude-skill');

      const skillPath = join(tmpDir, '.claude', 'skills', 'gitpm', 'SKILL.md');
      await expect(readFile(skillPath, 'utf-8')).rejects.toThrow();
    });

    it('does not overwrite an existing skill file', async () => {
      const metaDir = join(tmpDir, '.meta');
      mockScaffoldMeta.mockResolvedValue({ ok: true, value: undefined });
      await seedMetaDir(metaDir);

      const skillDir = join(tmpDir, '.claude', 'skills', 'gitpm');
      const skillPath = join(skillDir, 'SKILL.md');
      const userEditedContent = '# my customized skill — do not overwrite';
      await mkdir(skillDir, { recursive: true });
      await writeFile(skillPath, userEditedContent, 'utf-8');

      await run('my-project', '--meta-dir', metaDir);

      const after = await readFile(skillPath, 'utf-8');
      expect(after).toBe(userEditedContent);
    });

    it('places the skill next to .meta/ even when metaDir is nested', async () => {
      // Simulate a consumer running `gitpm init --meta-dir apps/web/.meta`.
      const projectRoot = join(tmpDir, 'apps', 'web');
      const metaDir = join(projectRoot, '.meta');
      mockScaffoldMeta.mockResolvedValue({ ok: true, value: undefined });
      await seedMetaDir(metaDir);

      await run('nested-proj', '--meta-dir', metaDir);

      // Skill lives alongside .meta/, not at tmpDir root
      const skillPath = join(
        projectRoot,
        '.claude',
        'skills',
        'gitpm',
        'SKILL.md',
      );
      const body = await readFile(skillPath, 'utf-8');
      expect(body).toContain('name: gitpm');
    });
  });
});
