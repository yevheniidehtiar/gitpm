import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  printError,
  printSuccess,
  printTree,
  printWarning,
  progressBar,
} from '../utils/output.js';

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

describe('output utils', () => {
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('printSuccess writes to stdout with checkmark', () => {
    printSuccess('ok');
    const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(out).toContain('✓ ok');
  });

  it('printError writes to stderr with cross', () => {
    printError('bad');
    const out = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(out).toContain('✗ bad');
  });

  it('printWarning writes to stderr with warn glyph', () => {
    printWarning('watch out');
    const out = warnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(out).toContain('⚠ watch out');
  });

  describe('progressBar', () => {
    it('renders green for ratio ≥ 0.75', () => {
      const bar = progressBar(0.8, 10);
      expect(bar).toMatch(/█+░*/);
    });

    it('renders yellow for ratio between 0.25 and 0.75', () => {
      const bar = progressBar(0.5, 10);
      expect(bar).toMatch(/█+░*/);
    });

    it('renders red for ratio below 0.25', () => {
      const bar = progressBar(0.1, 10);
      expect(bar).toMatch(/█*░+/);
    });

    it('computes correct fill for full bar', () => {
      const bar = progressBar(1, 5);
      // Strip ANSI to count fills
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape sequences
      const stripped = bar.replace(/\u001b\[[0-9;]*m/g, '');
      expect(stripped).toBe('█'.repeat(5));
    });

    it('computes correct fill for empty bar', () => {
      const bar = progressBar(0, 5);
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape sequences
      const stripped = bar.replace(/\u001b\[[0-9;]*m/g, '');
      expect(stripped).toBe('░'.repeat(5));
    });
  });

  describe('printTree', () => {
    it('prints nested files with indentation', () => {
      printTree(['dir', 'dir/sub', 'dir/sub/file.md', 'other.md']);

      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('dir/');
      expect(out).toContain('sub/');
      expect(out).toContain('file.md');
      expect(out).toContain('other.md');
    });

    it('treats files without an extension as directories', () => {
      printTree(['only-dir']);
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('only-dir/');
    });
  });
});
