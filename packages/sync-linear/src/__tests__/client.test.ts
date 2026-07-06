import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinearIssue, LinearTeam } from '../client.js';
import { LinearClient } from '../client.js';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createClient(): LinearClient {
  return new LinearClient({ apiKey: 'test-api-key' });
}

function graphqlResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function graphqlErrorResponse(message: string): Response {
  return new Response(JSON.stringify({ errors: [{ message }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const baseIssue = {
  id: 'issue-1',
  identifier: 'ENG-1',
  title: 'Test issue',
  description: null,
  priority: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  state: { id: 'state-1', name: 'Todo', type: 'unstarted' },
  assignee: null,
  labels: { nodes: [] },
  parent: null,
  children: { nodes: [] },
  cycle: null,
  project: null,
};

describe('LinearClient', () => {
  describe('listTeams', () => {
    it('sends the auth header and returns teams', async () => {
      const teams: LinearTeam[] = [
        { id: 't1', name: 'Engineering', key: 'ENG' },
      ];
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ teams: { nodes: teams } }),
      );

      const client = createClient();
      const result = await client.listTeams();

      expect(result).toEqual(teams);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.linear.app/graphql');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('test-api-key');
    });
  });

  describe('listWorkflowStates', () => {
    it('returns workflow states for a team', async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          team: {
            states: {
              nodes: [
                { id: 's1', name: 'Todo', type: 'unstarted' },
                { id: 's2', name: 'Done', type: 'completed' },
              ],
            },
          },
        }),
      );

      const client = createClient();
      const result = await client.listWorkflowStates('team-1');
      expect(result).toHaveLength(2);
      expect(result[1].type).toBe('completed');
    });
  });

  describe('listCycles', () => {
    it('returns cycles for a team', async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          team: {
            cycles: {
              nodes: [{ id: 'c1', number: 1, name: 'Cycle 1' }],
            },
          },
        }),
      );

      const client = createClient();
      const result = await client.listCycles('team-1');
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(1);
    });
  });

  describe('listProjects', () => {
    it('returns projects for a team', async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          team: {
            projects: { nodes: [{ id: 'p1', name: 'Roadmap' }] },
          },
        }),
      );

      const client = createClient();
      const result = await client.listProjects('team-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Roadmap');
    });
  });

  describe('listIssues', () => {
    it('paginates through results using cursor pagination', async () => {
      const page1Issue: LinearIssue = { ...baseIssue, id: 'issue-1' };
      const page2Issue: LinearIssue = { ...baseIssue, id: 'issue-2' };

      mockFetch
        .mockResolvedValueOnce(
          graphqlResponse({
            team: {
              issues: {
                nodes: [page1Issue],
                pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
              },
            },
          }),
        )
        .mockResolvedValueOnce(
          graphqlResponse({
            team: {
              issues: {
                nodes: [page2Issue],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          }),
        );

      const client = createClient();
      const result = await client.listIssues('team-1');

      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [, secondInit] = mockFetch.mock.calls[1];
      const body = JSON.parse(secondInit.body);
      expect(body.variables.after).toBe('cursor-1');
    });
  });

  describe('getIssue', () => {
    it('returns issue when found', async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issue: { ...baseIssue } }),
      );

      const client = createClient();
      const result = await client.getIssue('issue-1');
      expect(result?.identifier).toBe('ENG-1');
    });

    it('returns null when the request fails', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Not found', { status: 404 }),
      );

      const client = createClient();
      const result = await client.getIssue('missing');
      expect(result).toBeNull();
    });
  });

  describe('createIssue', () => {
    it('sends the correct mutation input', async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          issueCreate: {
            success: true,
            issue: { ...baseIssue, title: 'New issue' },
          },
        }),
      );

      const client = createClient();
      const result = await client.createIssue({
        teamId: 'team-1',
        title: 'New issue',
        description: 'Description',
        priority: 2,
      });

      expect(result.title).toBe('New issue');
      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.variables.input.teamId).toBe('team-1');
      expect(body.variables.input.title).toBe('New issue');
      expect(body.variables.input.priority).toBe(2);
    });

    it('throws when the mutation reports failure', async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issueCreate: { success: false, issue: null } }),
      );

      const client = createClient();
      await expect(
        client.createIssue({ teamId: 'team-1', title: 'Fails' }),
      ).rejects.toThrow('issueCreate mutation reported failure');
    });
  });

  describe('updateIssue', () => {
    it('sends only provided fields', async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({ issueUpdate: { success: true } }),
      );

      const client = createClient();
      await client.updateIssue('issue-1', { title: 'Updated', priority: 1 });

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.variables.id).toBe('issue-1');
      expect(body.variables.input.title).toBe('Updated');
      expect(body.variables.input.priority).toBe(1);
      expect(body.variables.input.description).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('throws on non-ok HTTP responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Server error', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

      const client = createClient();
      await expect(client.listTeams()).rejects.toThrow('Linear API error 500');
    });

    it('throws on GraphQL errors array', async () => {
      mockFetch.mockResolvedValueOnce(graphqlErrorResponse('Team not found'));

      const client = createClient();
      await expect(client.listTeams()).rejects.toThrow('Team not found');
    });
  });

  describe('rate limiting', () => {
    it('handles 429 response with Retry-After then surfaces the error', async () => {
      const rateLimitResponse = new Response('Rate limited', {
        status: 429,
        headers: { 'Retry-After': '0' },
      });

      mockFetch.mockResolvedValueOnce(rateLimitResponse);

      const client = createClient();
      await expect(client.listTeams()).rejects.toThrow('Linear API error 429');
    });
  });
});
