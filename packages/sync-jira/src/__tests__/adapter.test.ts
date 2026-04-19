import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jiraAdapter } from '../adapter.js';
import { createDefaultConfig, saveConfig } from '../config.js';

const EMAIL = 'user@example.com';
const TOKEN = 'secret-token';
const SITE = 'test.atlassian.net';
const PROJECT_KEY = 'TEST';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function notFoundResponse(): Response {
  return new Response('Not found', { status: 404 });
}

describe('jiraAdapter', () => {
  let tmpDir: string;
  let metaDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gitpm-jira-adapter-'));
    metaDir = join(tmpDir, '.meta');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('exposes adapter name and display name', () => {
    expect(jiraAdapter.name).toBe('jira');
    expect(jiraAdapter.displayName).toBe('Jira');
  });

  describe('detect', () => {
    it('returns false when no config exists', async () => {
      const ok = await jiraAdapter.detect(metaDir);
      expect(ok).toBe(false);
    });

    it('returns true when a config is present', async () => {
      const config = createDefaultConfig(SITE, PROJECT_KEY);
      await saveConfig(metaDir, config);
      const ok = await jiraAdapter.detect(metaDir);
      expect(ok).toBe(true);
    });
  });

  describe('import', () => {
    it('rejects when email is missing', async () => {
      const result = await jiraAdapter.import({
        metaDir,
        apiToken: TOKEN,
        site: SITE,
        projectKey: PROJECT_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('email');
    });

    it('rejects when api token is missing', async () => {
      const result = await jiraAdapter.import({
        metaDir,
        email: EMAIL,
        site: SITE,
        projectKey: PROJECT_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('API token');
    });

    it('rejects when site is missing', async () => {
      const result = await jiraAdapter.import({
        metaDir,
        email: EMAIL,
        apiToken: TOKEN,
        projectKey: PROJECT_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('site');
    });

    it('rejects when project key is missing', async () => {
      const result = await jiraAdapter.import({
        metaDir,
        email: EMAIL,
        apiToken: TOKEN,
        site: SITE,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('project key');
    });

    it('reads credentials from the credentials bag', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/board?projectKeyOrId=')) return notFoundResponse();
        if (url.includes('/search?jql=')) {
          return jsonResponse({ issues: [], total: 0 });
        }
        return notFoundResponse();
      });

      const result = await jiraAdapter.import({
        metaDir,
        credentials: {
          email: EMAIL,
          apiToken: TOKEN,
          site: SITE,
          projectKey: PROJECT_KEY,
        },
      });
      expect(result.ok).toBe(true);
    });

    it('falls back to options.token when apiToken is missing', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/board?projectKeyOrId=')) return notFoundResponse();
        if (url.includes('/search?jql=')) {
          return jsonResponse({ issues: [], total: 0 });
        }
        return notFoundResponse();
      });

      const result = await jiraAdapter.import({
        metaDir,
        email: EMAIL,
        token: TOKEN,
        site: SITE,
        projectKey: PROJECT_KEY,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('export', () => {
    it('rejects when email is missing', async () => {
      const result = await jiraAdapter.export({
        metaDir,
        apiToken: TOKEN,
        site: SITE,
        projectKey: PROJECT_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('email');
    });

    it('rejects when api token is missing', async () => {
      const result = await jiraAdapter.export({
        metaDir,
        email: EMAIL,
        site: SITE,
        projectKey: PROJECT_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('API token');
    });

    it('rejects when site cannot be resolved from options or config', async () => {
      const result = await jiraAdapter.export({
        metaDir,
        email: EMAIL,
        apiToken: TOKEN,
        projectKey: PROJECT_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('site');
    });

    it('rejects when project key cannot be resolved', async () => {
      const result = await jiraAdapter.export({
        metaDir,
        email: EMAIL,
        apiToken: TOKEN,
        site: SITE,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('project key');
    });

    it('reads site and project key from saved config when not in options', async () => {
      const config = createDefaultConfig(SITE, PROJECT_KEY);
      await saveConfig(metaDir, config);

      // The adapter's job here is to resolve credentials and delegate. With
      // no entities on disk, the underlying export runs successfully and
      // reports zero changes — which confirms credential resolution worked.
      const result = await jiraAdapter.export({
        metaDir,
        email: EMAIL,
        apiToken: TOKEN,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalChanges).toBe(0);
      }
    });

    it('passes credentials from the credentials bag', async () => {
      const config = createDefaultConfig(SITE, PROJECT_KEY);
      await saveConfig(metaDir, config);

      const result = await jiraAdapter.export({
        metaDir,
        credentials: {
          email: EMAIL,
          apiToken: TOKEN,
          site: SITE,
          projectKey: PROJECT_KEY,
        },
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('sync', () => {
    it('rejects when email is missing', async () => {
      const result = await jiraAdapter.sync({
        metaDir,
        apiToken: TOKEN,
        site: SITE,
        projectKey: PROJECT_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('email');
    });

    it('rejects when api token is missing', async () => {
      const result = await jiraAdapter.sync({
        metaDir,
        email: EMAIL,
        site: SITE,
        projectKey: PROJECT_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('API token');
    });

    it('rejects when site cannot be resolved', async () => {
      const result = await jiraAdapter.sync({
        metaDir,
        email: EMAIL,
        apiToken: TOKEN,
        projectKey: PROJECT_KEY,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('site');
    });

    it('rejects when project key cannot be resolved', async () => {
      const result = await jiraAdapter.sync({
        metaDir,
        email: EMAIL,
        apiToken: TOKEN,
        site: SITE,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('project key');
    });

    it('delegates to syncWithJira when credentials resolve', async () => {
      const config = createDefaultConfig(SITE, PROJECT_KEY);
      await saveConfig(metaDir, config);

      const result = await jiraAdapter.sync({
        metaDir,
        credentials: {
          email: EMAIL,
          apiToken: TOKEN,
          site: SITE,
          projectKey: PROJECT_KEY,
        },
        strategy: 'local-wins',
      });
      // Missing sync state → sync returns an error; we still exercised the
      // credential-resolution path in the adapter.
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('No Jira sync state found');
      }
    });

    it('falls back to options.token for sync when apiToken is missing', async () => {
      const config = createDefaultConfig(SITE, PROJECT_KEY);
      await saveConfig(metaDir, config);

      const result = await jiraAdapter.sync({
        metaDir,
        email: EMAIL,
        token: TOKEN,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('No Jira sync state found');
      }
    });
  });
});
