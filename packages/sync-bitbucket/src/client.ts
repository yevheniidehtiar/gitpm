import type { Result } from '@gitpm/core';
import type {
  BbComment,
  BbComponent,
  BbIssue,
  BbMilestone,
  BbPage,
  BbRepository,
  CreateIssueParams,
  UpdateIssueParams,
} from './types.js';

export const DEFAULT_BASE_URL = 'https://api.bitbucket.org/2.0';

/**
 * Atlassian API token (email + token, HTTP Basic) or a workspace/repository
 * access token (Bearer). App passwords are deprecated and not supported.
 */
export type BitbucketAuth =
  | { kind: 'basic'; email: string; token: string }
  | { kind: 'bearer'; token: string };

export interface BitbucketError {
  /** HTTP status, or null when the request never got a response. */
  status: number | null;
  message: string;
}

export interface BitbucketClientOptions {
  auth: BitbucketAuth;
  baseUrl?: string;
  /** Retries after the first attempt for 429, 5xx and network errors. */
  maxRetries?: number;
  /** Overridable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface ListIssuesOptions {
  /** BBQL filter, e.g. `state="open"`. */
  q?: string;
  sort?: string;
}

type ApiResult<T> = Promise<Result<T, BitbucketError>>;

export interface BitbucketClient {
  getRepository(workspace: string, repo: string): ApiResult<BbRepository>;
  listIssues(
    workspace: string,
    repo: string,
    options?: ListIssuesOptions,
  ): ApiResult<BbIssue[]>;
  getIssue(workspace: string, repo: string, id: number): ApiResult<BbIssue>;
  createIssue(
    workspace: string,
    repo: string,
    params: CreateIssueParams,
  ): ApiResult<BbIssue>;
  updateIssue(
    workspace: string,
    repo: string,
    id: number,
    params: UpdateIssueParams,
  ): ApiResult<BbIssue>;
  /** Read-only: REST 2.0 has no endpoint to create or edit milestones. */
  listMilestones(workspace: string, repo: string): ApiResult<BbMilestone[]>;
  /** Read-only: REST 2.0 has no endpoint to create or edit components. */
  listComponents(workspace: string, repo: string): ApiResult<BbComponent[]>;
  listIssueComments(
    workspace: string,
    repo: string,
    id: number,
  ): ApiResult<BbComment[]>;
  createIssueComment(
    workspace: string,
    repo: string,
    id: number,
    raw: string,
  ): ApiResult<BbComment>;
}

const PAGE_LEN = 50;

function authHeader(auth: BitbucketAuth): string {
  if (auth.kind === 'bearer') return `Bearer ${auth.token}`;
  const encoded = Buffer.from(`${auth.email}:${auth.token}`).toString('base64');
  return `Basic ${encoded}`;
}

/** Pull the human message out of Bitbucket's `{ type: "error", error: { message } }` body. */
function errorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed.error?.message) {
      return `Bitbucket API error ${status}: ${parsed.error.message}`;
    }
  } catch {
    // Not JSON: fall through to the raw body.
  }
  return `Bitbucket API error ${status}: ${body || 'no response body'}`;
}

/** Reading a body can fail (connection reset); never let it throw. */
function safeText(response: Response): Promise<string> {
  return response.text().catch(() => '');
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get('Retry-After'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return 2 ** attempt * 1000;
}

function repoPath(workspace: string, repo: string): string {
  return `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}`;
}

export function createBitbucketClient(
  options: BitbucketClientOptions,
): BitbucketClient {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const origin = new URL(baseUrl).origin;
  const maxRetries = options.maxRetries ?? 3;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const authorization = authHeader(options.auth);

  async function requestUrl<T>(url: string, init?: RequestInit): ApiResult<T> {
    let lastError: BitbucketError = {
      status: null,
      message: 'Bitbucket API request failed',
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          headers: {
            Authorization: authorization,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...init?.headers,
          },
        });
      } catch (cause) {
        lastError = {
          status: null,
          message: `Bitbucket request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        };
        if (attempt < maxRetries) await sleep(2 ** attempt * 1000);
        continue;
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = {
          status: response.status,
          message: errorMessage(response.status, await safeText(response)),
        };
        if (attempt < maxRetries) await sleep(retryDelayMs(response, attempt));
        continue;
      }

      const body = await safeText(response);
      if (!response.ok) {
        return {
          ok: false,
          error: {
            status: response.status,
            message: errorMessage(response.status, body),
          },
        };
      }

      try {
        return { ok: true, value: (body ? JSON.parse(body) : null) as T };
      } catch {
        return {
          ok: false,
          error: {
            status: response.status,
            message: 'Bitbucket API returned invalid JSON',
          },
        };
      }
    }

    return { ok: false, error: lastError };
  }

  function request<T>(path: string, init?: RequestInit): ApiResult<T> {
    return requestUrl<T>(`${baseUrl}${path}`, init);
  }

  async function paginate<T>(
    path: string,
    params: Record<string, string | undefined> = {},
  ): ApiResult<T[]> {
    const query = new URLSearchParams({ pagelen: String(PAGE_LEN) });
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, value);
    }

    const results: T[] = [];
    let url: string | undefined = `${baseUrl}${path}?${query.toString()}`;
    while (url) {
      const page: Result<BbPage<T>, BitbucketError> = await requestUrl<
        BbPage<T>
      >(url);
      if (!page.ok) return page;
      results.push(...page.value.values);

      const next: string | undefined = page.value.next;
      // Never send credentials to a host other than the configured API.
      if (next && new URL(next).origin !== origin) {
        return {
          ok: false,
          error: {
            status: null,
            message: `Refusing to follow pagination link to another host: ${new URL(next).origin}`,
          },
        };
      }
      url = next;
    }
    return { ok: true, value: results };
  }

  const json = (method: string, body: unknown): RequestInit => ({
    method,
    body: JSON.stringify(body),
  });

  return {
    getRepository: (workspace, repo) =>
      request<BbRepository>(repoPath(workspace, repo)),

    listIssues: (workspace, repo, opts) =>
      paginate<BbIssue>(`${repoPath(workspace, repo)}/issues`, {
        q: opts?.q,
        sort: opts?.sort ?? 'created_on',
      }),

    getIssue: (workspace, repo, id) =>
      request<BbIssue>(`${repoPath(workspace, repo)}/issues/${id}`),

    createIssue: (workspace, repo, params) =>
      request<BbIssue>(
        `${repoPath(workspace, repo)}/issues`,
        json('POST', params),
      ),

    updateIssue: (workspace, repo, id, params) =>
      request<BbIssue>(
        `${repoPath(workspace, repo)}/issues/${id}`,
        json('PUT', params),
      ),

    listMilestones: (workspace, repo) =>
      paginate<BbMilestone>(`${repoPath(workspace, repo)}/milestones`),

    listComponents: (workspace, repo) =>
      paginate<BbComponent>(`${repoPath(workspace, repo)}/components`),

    listIssueComments: (workspace, repo, id) =>
      paginate<BbComment>(`${repoPath(workspace, repo)}/issues/${id}/comments`),

    createIssueComment: (workspace, repo, id, raw) =>
      request<BbComment>(
        `${repoPath(workspace, repo)}/issues/${id}/comments`,
        json('POST', { content: { raw } }),
      ),
  };
}
