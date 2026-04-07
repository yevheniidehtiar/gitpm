import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadQualityConfig } from './config.js';

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `gitpm-quality-config-test-${Date.now()}`);
  await mkdir(join(testDir, '.gitpm'), { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('loadQualityConfig', () => {
  it('returns null when config file does not exist', async () => {
    const result = await loadQualityConfig(testDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  it('parses valid config with template and threshold', async () => {
    const yaml = `
template:
  required_sections:
    - Motivation
    - Acceptance Criteria
  min_coverage: 0.75
threshold:
  min_average: 5.0
`;
    await writeFile(join(testDir, '.gitpm', 'quality.yaml'), yaml);
    const result = await loadQualityConfig(testDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      template: {
        required_sections: ['Motivation', 'Acceptance Criteria'],
        min_coverage: 0.75,
      },
      threshold: { min_average: 5.0 },
    });
  });

  it('applies default min_coverage of 0.5', async () => {
    const yaml = `
template:
  required_sections:
    - Summary
`;
    await writeFile(join(testDir, '.gitpm', 'quality.yaml'), yaml);
    const result = await loadQualityConfig(testDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.template?.min_coverage).toBe(0.5);
  });

  it('parses config with only threshold', async () => {
    const yaml = `
threshold:
  min_average: 3.0
`;
    await writeFile(join(testDir, '.gitpm', 'quality.yaml'), yaml);
    const result = await loadQualityConfig(testDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.template).toBeUndefined();
    expect(result.value?.threshold?.min_average).toBe(3.0);
  });

  it('returns error for invalid YAML structure', async () => {
    const yaml = `
template:
  required_sections: "not an array"
`;
    await writeFile(join(testDir, '.gitpm', 'quality.yaml'), yaml);
    const result = await loadQualityConfig(testDir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('Invalid quality config');
  });
});
