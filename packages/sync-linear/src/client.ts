export interface LinearClientOptions {
  apiKey: string;
  apiUrl?: string;
  /** Max retries after a 429 response (default 3). */
  maxRetries?: number;
}

interface GraphQLError {
  message: string;
  extensions?: { code?: string; type?: string };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

interface Connection<T> {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

/** An Error carrying the HTTP status and GraphQL errors returned by Linear. */
export type LinearApiError = Error & {
  status?: number;
  graphqlErrors?: GraphQLError[];
};

function linearApiError(
  message: string,
  extra: { status?: number; graphqlErrors?: GraphQLError[] },
): LinearApiError {
  return Object.assign(new Error(message), extra);
}

/** True only when Linear reports that the requested entity does not exist. */
export function isNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const gqlErrors = (err as LinearApiError).graphqlErrors ?? [];
  return gqlErrors.some((e) => /entity not found/i.test(e.message));
}

const PAGE_SIZE = 100;
const DEFAULT_RETRY_DELAY_MS = 1000;

export class LinearClient {
  private apiUrl: string;
  private apiKey: string;
  private maxRetries: number;

  constructor(options: LinearClientOptions) {
    this.apiUrl = options.apiUrl ?? 'https://api.linear.app/graphql';
    this.apiKey = options.apiKey;
    this.maxRetries = options.maxRetries ?? 3;
  }

  private async request<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      // Linear reports some GraphQL errors (not-found, RATELIMITED, ...)
      // with a non-2xx status, so the body is parsed regardless of status.
      const text = await response.text();
      const json = parseGraphQLBody<T>(text);
      const errors = json?.errors?.length ? json.errors : undefined;

      if (
        (response.status === 429 || isRateLimited(errors)) &&
        attempt < this.maxRetries
      ) {
        attempt++;
        const waitMs = retryDelayMs(response, attempt);
        console.warn(
          `Linear rate limit hit. Retrying in ${Math.ceil(waitMs / 1000)}s (attempt ${attempt}/${this.maxRetries}).`,
        );
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        const detail = errors ? errors.map((e) => e.message).join('; ') : text;
        throw linearApiError(
          `Linear API error ${response.status}: ${response.statusText} — ${detail}`,
          { status: response.status, graphqlErrors: errors },
        );
      }

      if (errors) {
        throw linearApiError(
          `Linear API error: ${errors.map((e) => e.message).join('; ')}`,
          { status: response.status, graphqlErrors: errors },
        );
      }
      if (!json) {
        throw linearApiError(
          `Linear API error: response is not valid JSON — ${text}`,
          { status: response.status },
        );
      }

      return json.data as T;
    }
  }

  /**
   * Fetches every page of a connection. The query must declare
   * `$first: Int!` and `$after: String`; `select` picks the connection.
   */
  private async paginate<T, R>(
    query: string,
    variables: Record<string, unknown>,
    select: (data: R) => Connection<T>,
  ): Promise<T[]> {
    const results: T[] = [];
    let after: string | undefined;
    while (true) {
      const data = await this.request<R>(query, {
        ...variables,
        first: PAGE_SIZE,
        after,
      });
      const page = select(data);
      results.push(...page.nodes);
      if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
      after = page.pageInfo.endCursor;
    }
    return results;
  }

  async listTeams(): Promise<LinearTeam[]> {
    const query = `
      query Teams($first: Int!, $after: String) {
        teams(first: $first, after: $after) {
          nodes { id name key }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    return this.paginate<LinearTeam, { teams: Connection<LinearTeam> }>(
      query,
      {},
      (d) => d.teams,
    );
  }

  async listWorkflowStates(teamId: string): Promise<LinearWorkflowState[]> {
    const query = `
      query WorkflowStates($teamId: String!, $first: Int!, $after: String) {
        team(id: $teamId) {
          states(first: $first, after: $after) {
            nodes { id name type position }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `;
    return this.paginate<
      LinearWorkflowState,
      { team: { states: Connection<LinearWorkflowState> } }
    >(query, { teamId }, (d) => d.team.states);
  }

  async listProjects(teamId: string): Promise<LinearProject[]> {
    const query = `
      query Projects($teamId: String!, $first: Int!, $after: String) {
        team(id: $teamId) {
          projects(first: $first, after: $after) {
            nodes { id name description }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `;
    return this.paginate<
      LinearProject,
      { team: { projects: Connection<LinearProject> } }
    >(query, { teamId }, (d) => d.team.projects);
  }

  /** Lists labels usable by the team: its own labels plus workspace labels. */
  async listIssueLabels(teamId: string): Promise<LinearIssueLabel[]> {
    const query = `
      query IssueLabels($teamId: ID!, $first: Int!, $after: String) {
        issueLabels(
          first: $first
          after: $after
          filter: { or: [{ team: { id: { eq: $teamId } } }, { team: { null: true } }] }
        ) {
          nodes { id name }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    return this.paginate<
      LinearIssueLabel,
      { issueLabels: Connection<LinearIssueLabel> }
    >(query, { teamId }, (d) => d.issueLabels);
  }

  async listUsers(): Promise<LinearUser[]> {
    const query = `
      query Users($first: Int!, $after: String) {
        users(first: $first, after: $after) {
          nodes { id name displayName }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    return this.paginate<LinearUser, { users: Connection<LinearUser> }>(
      query,
      {},
      (d) => d.users,
    );
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
      query Cycles($teamId: String!, $first: Int!, $after: String) {
        team(id: $teamId) {
          cycles(first: $first, after: $after) {
            nodes { id number name startsAt endsAt completedAt }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `;
    return this.paginate<
      LinearCycle,
      { team: { cycles: Connection<LinearCycle> } }
    >(query, { teamId }, (d) => d.team.cycles);
  }

  async listIssues(teamId: string): Promise<LinearIssue[]> {
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
    return this.paginate<
      LinearIssue,
      { team: { issues: Connection<LinearIssue> } }
    >(query, { teamId }, (d) => d.team.issues);
  }

  /**
   * Returns `null` only when Linear reports the issue does not exist. Any
   * other failure (auth, network, rate limit, server error) is rethrown so
   * callers never mistake an outage for a remote deletion.
   */
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
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
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
      ...(params.assigneeId && { assigneeId: params.assigneeId }),
    };

    const data = await this.request<{
      issueCreate: { success: boolean; issue: LinearIssue };
    }>(mutation, { input });

    if (!data.issueCreate.success) {
      throw new Error('Linear issueCreate mutation reported failure');
    }

    return data.issueCreate.issue;
  }

  /** Updates an issue and returns its state after the update. */
  async updateIssue(
    issueId: string,
    params: UpdateLinearIssueParams,
  ): Promise<LinearIssue> {
    const mutation = `
      mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue { ${ISSUE_FIELDS} }
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
    if (params.assigneeId !== undefined) input.assigneeId = params.assigneeId;

    const data = await this.request<{
      issueUpdate: { success: boolean; issue: LinearIssue };
    }>(mutation, { id: issueId, input });

    if (!data.issueUpdate.success) {
      throw new Error('Linear issueUpdate mutation reported failure');
    }

    return data.issueUpdate.issue;
  }
}

function parseGraphQLBody<T>(text: string): GraphQLResponse<T> | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as GraphQLResponse<T>)
      : undefined;
  } catch {
    return undefined;
  }
}

function isRateLimited(errors: GraphQLError[] | undefined): boolean {
  return (errors ?? []).some((e) => e.extensions?.code === 'RATELIMITED');
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number.parseInt(
    response.headers.get('Retry-After') ?? '',
    10,
  );
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter * 1000;
  return DEFAULT_RETRY_DELAY_MS * 2 ** (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export interface LinearUser {
  id: string;
  name: string;
  displayName?: string;
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
  assigneeId?: string;
}

export interface UpdateLinearIssueParams {
  title?: string;
  description?: string;
  priority?: number;
  stateId?: string;
  labelIds?: string[];
  /** `null` unassigns the issue. */
  assigneeId?: string | null;
}
