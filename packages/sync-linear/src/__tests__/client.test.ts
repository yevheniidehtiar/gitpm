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
        graphqlResponse({
          teams: {
            nodes: teams,
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        }),
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
              pageInfo: { hasNextPage: false, endCursor: null },
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
              pageInfo: { hasNextPage: false, endCursor: null },
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
            projects: {
              nodes: [{ id: 'p1', name: 'Roadmap' }],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
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

    it('returns null when Linear reports the entity is not found', async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlErrorResponse('Entity not found: Issue'),
      );

      const client = createClient();
      const result = await client.getIssue('missing');
      expect(result).toBeNull();
    });

    it('returns null when the issue field is null', async () => {
      mockFetch.mockResolvedValueOnce(graphqlResponse({ issue: null }));

      const client = createClient();
      expect(await client.getIssue('missing')).toBeNull();
    });

    it('propagates auth failures instead of reporting a deletion', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 }),
      );

      const client = createClient();
      await expect(client.getIssue('issue-1')).rejects.toThrow(
        'Linear API error 401',
      );
    });

    it('propagates network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const client = createClient();
      await expect(client.getIssue('issue-1')).rejects.toThrow('fetch failed');
    });

    it('propagates unrelated GraphQL errors', async () => {
      mockFetch.mockResolvedValueOnce(graphqlErrorResponse('Internal error'));

      const client = createClient();
      await expect(client.getIssue('issue-1')).rejects.toThrow(
        'Internal error',
      );
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
        graphqlResponse({ issueUpdate: { success: true, issue: baseIssue } }),
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

    it('sends explicit clears and returns the updated issue', async () => {
      mockFetch.mockResolvedValueOnce(
        graphqlResponse({
          issueUpdate: { success: true, issue: { ...baseIssue, title: 'X' } },
        }),
      );

      const client = createClient();
      const updated = await client.updateIssue('issue-1', {
        description: '',
        labelIds: [],
        assigneeId: null,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.variables.input).toEqual({
        description: '',
        labelIds: [],
        assigneeId: null,
      });
      expect(updated.title).toBe('X');
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
    function rateLimited(): Response {
      return new Response('Rate limited', {
        status: 429,
        headers: { 'Retry-After': '0' },
      });
    }

    it('retries after a 429 and returns the successful response', async () => {
      mockFetch.mockResolvedValueOnce(rateLimited()).mockResolvedValueOnce(
        graphqlResponse({
          teams: {
            nodes: [{ id: 't1', name: 'Engineering', key: 'ENG' }],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        }),
      );

      const client = createClient();
      const teams = await client.listTeams();
      expect(teams).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('surfaces the 429 once retries are exhausted', async () => {
      mockFetch.mockImplementation(async () => rateLimited());

      const client = new LinearClient({ apiKey: 'k', maxRetries: 2 });
      await expect(client.listTeams()).rejects.toThrow('Linear API error 429');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('pagination', () => {
    it('follows cursors for labels and includes workspace labels', async () => {
      mockFetch
        .mockResolvedValueOnce(
          graphqlResponse({
            issueLabels: {
              nodes: [{ id: 'l1', name: 'one' }],
              pageInfo: { hasNextPage: true, endCursor: 'c1' },
            },
          }),
        )
        .mockResolvedValueOnce(
          graphqlResponse({
            issueLabels: {
              nodes: [{ id: 'l2', name: 'two' }],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          }),
        );

      const client = createClient();
      const labels = await client.listIssueLabels('team-1');
      expect(labels.map((l) => l.name)).toEqual(['one', 'two']);

      const firstBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(firstBody.query).toContain('team: { null: true }');
      const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body as string);
      expect(secondBody.variables.after).toBe('c1');
    });

    it('follows cursors for workflow states and cycles', async () => {
      const page = (key: string, id: string, next: string | null) =>
        graphqlResponse({
          team: {
            [key]: {
              nodes: [{ id, name: id, type: 'unstarted', number: 1 }],
              pageInfo: { hasNextPage: next !== null, endCursor: next },
            },
          },
        });
      mockFetch
        .mockResolvedValueOnce(page('states', 's1', 'c'))
        .mockResolvedValueOnce(page('states', 's2', null))
        .mockResolvedValueOnce(page('cycles', 'c1', 'c'))
        .mockResolvedValueOnce(page('cycles', 'c2', null));

      const client = createClient();
      expect(await client.listWorkflowStates('team-1')).toHaveLength(2);
      expect(await client.listCycles('team-1')).toHaveLength(2);
    });
  });
});
