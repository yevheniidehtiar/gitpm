// Bitbucket Cloud REST 2.0 response types (the subset gitpm uses).

export type BbIssueState =
  | 'submitted'
  | 'new'
  | 'open'
  | 'resolved'
  | 'on hold'
  | 'invalid'
  | 'duplicate'
  | 'wontfix'
  | 'closed';

export type BbIssueKind = 'bug' | 'enhancement' | 'proposal' | 'task';

export type BbIssuePriority =
  | 'trivial'
  | 'minor'
  | 'major'
  | 'critical'
  | 'blocker';

export interface BbUser {
  account_id?: string;
  uuid?: string;
  display_name: string;
  nickname?: string;
}

export interface BbContent {
  raw: string;
  markup?: string;
  html?: string;
}

export interface BbRepository {
  uuid: string;
  slug: string;
  name: string;
  full_name: string;
  has_issues: boolean;
  workspace: { slug: string };
}

export interface BbIssue {
  id: number;
  title: string;
  content: BbContent;
  state: BbIssueState;
  kind: BbIssueKind;
  priority: BbIssuePriority;
  assignee: BbUser | null;
  reporter: BbUser | null;
  milestone: { id?: number; name: string } | null;
  component: { id?: number; name: string } | null;
  version: { id?: number; name: string } | null;
  votes: number;
  created_on: string;
  updated_on: string;
}

export interface BbMilestone {
  id: number;
  name: string;
}

export interface BbComponent {
  id: number;
  name: string;
}

export interface BbComment {
  id: number;
  content: BbContent;
  user: BbUser | null;
  created_on: string;
  updated_on: string | null;
}

/** Envelope Bitbucket wraps every list response in. */
export interface BbPage<T> {
  values: T[];
  next?: string;
  page?: number;
  pagelen?: number;
  size?: number;
}

export interface CreateIssueParams {
  title: string;
  content?: { raw: string };
  kind?: BbIssueKind;
  priority?: BbIssuePriority;
  state?: BbIssueState;
  assignee?: { account_id: string } | null;
  milestone?: { name: string } | null;
  component?: { name: string } | null;
}

export type UpdateIssueParams = Partial<CreateIssueParams>;
