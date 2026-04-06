import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JiraIssue, JiraProject, JiraSprint } from '../client.js';
import { JiraClient } from '../client.js';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createClient(): JiraClient {
  return new JiraClient({
    site: 'test.atlassian.net',
    email: 'test@test.com',
    apiToken: 'test-token',
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('JiraClient', () => {
  describe('listProjects', () => {
    it('fetches projects with correct auth header', async () => {
      const projects: JiraProject[] = [
        { id: '1', key: 'TEST', name: 'Test Project' },
      ];
      mockFetch.mockResolvedValueOnce(jsonResponse(projects));

      const client = createClient();
      const result = await client.listProjects();

      expect(result).toEqual(projects);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://test.atlassian.net/rest/api/3/project');
      expect(init.headers.Authorization).toMatch(/^Basic /);
    });
  });

  describe('searchIssues', () => {
    it('paginates through results', async () => {
      const page1 = {
        issues: Array.from({ length: 100 }, (_, i) => ({
          id: String(i),
          key: `TEST-${i}`,
          fields: {
            summary: `Issue ${i}`,
            description: null,
            status: { name: 'To Do', id: '1' },
            issuetype: { name: 'Story', id: '10001' },
            assignee: null,
            labels: [],
            priority: null,
            project: { key: 'TEST' },
            created: '2026-01-01T00:00:00Z',
            updated: '2026-01-01T00:00:00Z',
          },
        })),
        total: 150,
      };
      const page2 = {
        issues: Array.from({ length: 50 }, (_, i) => ({
          id: String(100 + i),
          key: `TEST-${100 + i}`,
          fields: {
            summary: `Issue ${100 + i}`,
            description: null,
            status: { name: 'To Do', id: '1' },
            issuetype: { name: 'Story', id: '10001' },
            assignee: null,
            labels: [],
            priority: null,
            project: { key: 'TEST' },
            created: '2026-01-01T00:00:00Z',
            updated: '2026-01-01T00:00:00Z',
          },
        })),
        total: 150,
      };

      mockFetch
        .mockResolvedValueOnce(jsonResponse(page1))
        .mockResolvedValueOnce(jsonResponse(page2));

      const client = createClient();
      const result = await client.searchIssues('project = TEST');

      expect(result).toHaveLength(150);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getIssue', () => {
    it('returns issue when found', async () => {
      const issue: JiraIssue = {
        id: '1',
        key: 'TEST-1',
        fields: {
          summary: 'Test',
          description: null,
          status: { name: 'To Do', id: '1' },
          issuetype: { name: 'Story', id: '10001' },
          assignee: null,
          labels: [],
          priority: null,
          project: { key: 'TEST' },
          created: '2026-01-01T00:00:00Z',
          updated: '2026-01-01T00:00:00Z',
        },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(issue));

      const client = createClient();
      const result = await client.getIssue('TEST-1');
      expect(result?.key).toBe('TEST-1');
    });

    it('returns null when issue not found', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Not found', { status: 404 }),
      );

      const client = createClient();
      const result = await client.getIssue('TEST-999');
      expect(result).toBeNull();
    });
  });

  describe('createIssue', () => {
    it('sends correct request body', async () => {
      const created: JiraIssue = {
        id: '100',
        key: 'TEST-100',
        fields: {
          summary: 'New Issue',
          description: 'Description',
          status: { name: 'To Do', id: '1' },
          issuetype: { name: 'Story', id: '10001' },
          assignee: null,
          labels: ['backend'],
          priority: null,
          project: { key: 'TEST' },
          created: '2026-01-01T00:00:00Z',
          updated: '2026-01-01T00:00:00Z',
        },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(created));

      const client = createClient();
      const result = await client.createIssue({
        projectKey: 'TEST',
        summary: 'New Issue',
        issueType: 'Story',
        description: 'Description',
        labels: ['backend'],
      });

      expect(result.key).toBe('TEST-100');
      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.fields.summary).toBe('New Issue');
      expect(body.fields.project.key).toBe('TEST');
    });
  });

  describe('getTransitions', () => {
    it('returns available transitions', async () => {
      const transitions = {
        transitions: [
          {
            id: '1',
            name: 'Start Progress',
            to: { name: 'In Progress', id: '3' },
          },
          { id: '2', name: 'Done', to: { name: 'Done', id: '4' } },
        ],
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(transitions));

      const client = createClient();
      const result = await client.getTransitions('TEST-1');
      expect(result).toHaveLength(2);
      expect(result[0].to.name).toBe('In Progress');
    });
  });

  describe('listSprints', () => {
    it('fetches sprints for a board', async () => {
      const sprints = {
        values: [
          { id: 1, name: 'Sprint 1', state: 'active' },
          { id: 2, name: 'Sprint 2', state: 'future' },
        ],
        total: 2,
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(sprints));

      const client = createClient();
      const result = await client.listSprints(42);
      expect(result).toHaveLength(2);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/rest/agile/1.0/board/42/sprint');
    });
  });

  describe('rate limiting', () => {
    it('handles 429 response with Retry-After', async () => {
      const rateLimitResponse = new Response('Rate limited', {
        status: 429,
        headers: { 'Retry-After': '1' },
      });
      const successResponse = jsonResponse([
        { id: '1', key: 'TEST', name: 'Test' },
      ]);

      mockFetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);

      const client = createClient();
      // The first call should throw (429 without retry)
      await expect(client.listProjects()).rejects.toThrow('Jira API error 429');
    });
  });
});
