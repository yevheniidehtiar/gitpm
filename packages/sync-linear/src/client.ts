export interface LinearClientOptions {
  apiKey: string;
  apiUrl?: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export class LinearClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(options: LinearClientOptions) {
    this.apiUrl = options.apiUrl ?? 'https://api.linear.app/graphql';
    this.apiKey = options.apiKey;
  }

  private async request<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    await this.checkRateLimit(response);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Linear API error ${response.status}: ${response.statusText} — ${body}`,
      );
    }

    const json = (await response.json()) as GraphQLResponse<T>;
    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `Linear API error: ${json.errors.map((e) => e.message).join('; ')}`,
      );
    }

    return json.data as T;
  }

  private async checkRateLimit(response: Response): Promise<void> {
    const retryAfter = response.headers.get('Retry-After');
    if (response.status === 429 && retryAfter) {
      const waitMs = Number.parseInt(retryAfter, 10) * 1000;
      if (waitMs > 0) {
        console.warn(
          `Linear rate limit hit. Sleeping ${Math.ceil(waitMs / 1000)}s.`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  async listTeams(): Promise<LinearTeam[]> {
    const query = `
      query Teams {
        teams {
          nodes { id name key }
        }
      }
    `;
    const data = await this.request<{ teams: { nodes: LinearTeam[] } }>(query);
    return data.teams.nodes;
  }

  async listWorkflowStates(teamId: string): Promise<LinearWorkflowState[]> {
    const query = `
      query WorkflowStates($teamId: String!) {
        team(id: $teamId) {
          states {
            nodes { id name type position }
          }
        }
      }
    `;
    const data = await this.request<{
      team: { states: { nodes: LinearWorkflowState[] } };
    }>(query, { teamId });
    return data.team.states.nodes;
  }

  async listProjects(teamId: string): Promise<LinearProject[]> {
    const query = `
      query Projects($teamId: String!) {
        team(id: $teamId) {
          projects {
            nodes { id name description }
          }
        }
      }
    `;
    const data = await this.request<{
      team: { projects: { nodes: LinearProject[] } };
    }>(query, { teamId });
    return data.team.projects.nodes;
  }

  async listIssueLabels(teamId: string): Promise<LinearIssueLabel[]> {
    const query = `
      query IssueLabels($teamId: String!) {
        team(id: $teamId) {
          labels {
            nodes { id name }
          }
        }
      }
    `;
    const data = await this.request<{
      team: { labels: { nodes: LinearIssueLabel[] } };
    }>(query, { teamId });
    return data.team.labels.nodes;
  }

  async createIssueLabel(
    teamId: string,
    name: string,
  ): Promise<LinearIssueLabel> {
    const mutation = `
      mutation IssueLabelCreate($input: IssueLabelCreateInput!) {
        issueLabelCreate(input: $input) {
          success
          issueLabel { id name }
        }
      }
    `;
    const data = await this.request<{
      issueLabelCreate: { success: boolean; issueLabel: LinearIssueLabel };
    }>(mutation, { input: { teamId, name } });

    if (!data.issueLabelCreate.success) {
      throw new Error('Linear issueLabelCreate mutation reported failure');
    }

    return data.issueLabelCreate.issueLabel;
  }

  async listCycles(teamId: string): Promise<LinearCycle[]> {
    const query = `
      query Cycles($teamId: String!) {
        team(id: $teamId) {
          cycles {
            nodes { id number name startsAt endsAt completedAt }
          }
        }
      }
    `;
    const data = await this.request<{
      team: { cycles: { nodes: LinearCycle[] } };
    }>(query, { teamId });
    return data.team.cycles.nodes;
  }

  async listIssues(teamId: string): Promise<LinearIssue[]> {
    const results: LinearIssue[] = [];
    let cursor: string | undefined;
    const pageSize = 50;

    while (true) {
      const query = `
        query Issues($teamId: String!, $after: String, $first: Int!) {
          team(id: $teamId) {
            issues(first: $first, after: $after) {
              nodes { ${ISSUE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      `;
      const data = await this.request<{
        team: {
          issues: {
            nodes: LinearIssue[];
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        };
      }>(query, { teamId, after: cursor, first: pageSize });

      const page = data.team.issues;
      results.push(...page.nodes);

      if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
      cursor = page.pageInfo.endCursor;
    }

    return results;
  }

  async getIssue(issueId: string): Promise<LinearIssue | null> {
    const query = `
      query Issue($id: String!) {
        issue(id: $id) { ${ISSUE_FIELDS} }
      }
    `;
    try {
      const data = await this.request<{ issue: LinearIssue | null }>(query, {
        id: issueId,
      });
      return data.issue ?? null;
    } catch {
      return null;
    }
  }

  async createIssue(params: CreateLinearIssueParams): Promise<LinearIssue> {
    const mutation = `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { ${ISSUE_FIELDS} }
        }
      }
    `;
    const input: Record<string, unknown> = {
      teamId: params.teamId,
      title: params.title,
      ...(params.description !== undefined && {
        description: params.description,
      }),
      ...(params.priority !== undefined && { priority: params.priority }),
      ...(params.stateId && { stateId: params.stateId }),
      ...(params.parentId && { parentId: params.parentId }),
      ...(params.labelIds && { labelIds: params.labelIds }),
    };

    const data = await this.request<{
      issueCreate: { success: boolean; issue: LinearIssue };
    }>(mutation, { input });

    if (!data.issueCreate.success) {
      throw new Error('Linear issueCreate mutation reported failure');
    }

    return data.issueCreate.issue;
  }

  async updateIssue(
    issueId: string,
    params: UpdateLinearIssueParams,
  ): Promise<void> {
    const mutation = `
      mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
        }
      }
    `;
    const input: Record<string, unknown> = {};
    if (params.title !== undefined) input.title = params.title;
    if (params.description !== undefined)
      input.description = params.description;
    if (params.priority !== undefined) input.priority = params.priority;
    if (params.stateId !== undefined) input.stateId = params.stateId;
    if (params.labelIds !== undefined) input.labelIds = params.labelIds;

    await this.request<{ issueUpdate: { success: boolean } }>(mutation, {
      id: issueId,
      input,
    });
  }
}

const ISSUE_FIELDS = `
  id
  identifier
  title
  description
  priority
  createdAt
  updatedAt
  state { id name type }
  assignee { id name }
  labels { nodes { name } }
  parent { id identifier title }
  children { nodes { id } }
  cycle { id number }
  project { id name }
`;

// Lightweight types for Linear API responses
export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearWorkflowState {
  id: string;
  name: string;
  type: string;
  position?: number;
}

export interface LinearProject {
  id: string;
  name: string;
  description?: string | null;
}

export interface LinearIssueLabel {
  id: string;
  name: string;
}

export interface LinearCycle {
  id: string;
  number: number;
  name?: string | null;
  startsAt?: string;
  endsAt?: string;
  completedAt?: string | null;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
  state: { id: string; name: string; type: string };
  assignee: { id: string; name: string } | null;
  labels: { nodes: Array<{ name: string }> };
  parent?: { id: string; identifier: string; title: string } | null;
  children?: { nodes: Array<{ id: string }> };
  cycle?: { id: string; number: number } | null;
  project?: { id: string; name: string } | null;
}

export interface CreateLinearIssueParams {
  teamId: string;
  title: string;
  description?: string;
  priority?: number;
  stateId?: string;
  parentId?: string;
  labelIds?: string[];
}

export interface UpdateLinearIssueParams {
  title?: string;
  description?: string;
  priority?: number;
  stateId?: string;
  labelIds?: string[];
}
