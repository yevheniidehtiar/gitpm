import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockLoadGitpmConfig = vi.fn();
const mockLoadAdapters = vi.fn();
const mockFindAdapterByName = vi.fn();
const mockDetectAdapter = vi.fn();

vi.mock('@gitpm/core', () => ({
  loadGitpmConfig: (...args: unknown[]) => mockLoadGitpmConfig(...args),
  loadAdapters: (...args: unknown[]) => mockLoadAdapters(...args),
  findAdapterByName: (...args: unknown[]) => mockFindAdapterByName(...args),
  detectAdapter: (...args: unknown[]) => mockDetectAdapter(...args),
}));

let _logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

function makeAdapter(name: string) {
  return {
    name,
    displayName: name,
    detect: vi.fn(),
    import: vi.fn(),
    export: vi.fn(),
    sync: vi.fn(),
  };
}

describe('resolveAdapter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    _logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits 1 when loadGitpmConfig fails', async () => {
    mockLoadGitpmConfig.mockResolvedValue({
      ok: false,
      error: { message: 'bad config' },
    });
    const { resolveAdapter } = await import('../utils/adapters.js');
    await expect(resolveAdapter('/tmp/m/.meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('bad config');
  });

  it('exits 1 when loadAdapters fails', async () => {
    mockLoadGitpmConfig.mockResolvedValue({
      ok: true,
      value: { adapters: [], hooks: {} },
    });
    mockLoadAdapters.mockResolvedValue({
      ok: false,
      error: { message: 'load failed' },
    });
    const { resolveAdapter } = await import('../utils/adapters.js');
    await expect(resolveAdapter('/tmp/m/.meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('load failed');
  });

  it('exits 1 when no adapters are installed', async () => {
    mockLoadGitpmConfig.mockResolvedValue({
      ok: true,
      value: { adapters: [], hooks: {} },
    });
    mockLoadAdapters.mockResolvedValue({ ok: true, value: [] });
    const { resolveAdapter } = await import('../utils/adapters.js');
    await expect(resolveAdapter('/tmp/m/.meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('No sync adapters installed');
  });

  it('exits 1 when adapter name is given but not found', async () => {
    mockLoadGitpmConfig.mockResolvedValue({
      ok: true,
      value: { adapters: [], hooks: {} },
    });
    const gh = makeAdapter('github');
    mockLoadAdapters.mockResolvedValue({ ok: true, value: [gh] });
    mockFindAdapterByName.mockReturnValue(null);

    const { resolveAdapter } = await import('../utils/adapters.js');
    await expect(resolveAdapter('/tmp/m/.meta', 'bitbucket')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('not found');
    expect(errOutput).toContain('github');
  });

  it('returns adapter when name is provided and found', async () => {
    const cfg = { adapters: [], hooks: {} };
    mockLoadGitpmConfig.mockResolvedValue({ ok: true, value: cfg });
    const gh = makeAdapter('github');
    mockLoadAdapters.mockResolvedValue({ ok: true, value: [gh] });
    mockFindAdapterByName.mockReturnValue(gh);

    const { resolveAdapter } = await import('../utils/adapters.js');
    const result = await resolveAdapter('/tmp/m/.meta', 'github');

    expect(result.adapter).toBe(gh);
    expect(result.config).toBe(cfg);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('auto-detects adapter when name is omitted', async () => {
    mockLoadGitpmConfig.mockResolvedValue({
      ok: true,
      value: { adapters: [], hooks: {} },
    });
    const gl = makeAdapter('gitlab');
    mockLoadAdapters.mockResolvedValue({ ok: true, value: [gl] });
    mockDetectAdapter.mockResolvedValue(gl);

    const { resolveAdapter } = await import('../utils/adapters.js');
    const result = await resolveAdapter('/tmp/m/.meta');

    expect(mockDetectAdapter).toHaveBeenCalled();
    expect(result.adapter).toBe(gl);
  });

  it('exits 1 when auto-detection finds no adapter', async () => {
    mockLoadGitpmConfig.mockResolvedValue({
      ok: true,
      value: { adapters: [], hooks: {} },
    });
    const gh = makeAdapter('github');
    mockLoadAdapters.mockResolvedValue({ ok: true, value: [gh] });
    mockDetectAdapter.mockResolvedValue(null);

    const { resolveAdapter } = await import('../utils/adapters.js');
    await expect(resolveAdapter('/tmp/m/.meta')).rejects.toThrow(
      'process.exit',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errOutput).toContain('No sync config found');
  });
});
