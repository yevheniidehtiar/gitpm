package schema

import "time"

type StoryFrontmatter struct {
	Type      string      `yaml:"type" json:"type"`
	ID        string      `yaml:"id" json:"id"`
	Title     string      `yaml:"title" json:"title"`
	Status    Status      `yaml:"status" json:"status"`
	Priority  Priority    `yaml:"priority" json:"priority"`
	Assignee  *string     `yaml:"assignee,omitempty" json:"assignee,omitempty"`
	Labels    []string    `yaml:"labels,omitempty" json:"labels,omitempty"`
	Estimate  *string     `yaml:"estimate,omitempty" json:"estimate,omitempty"`
	EpicRef   *EntityRef  `yaml:"epic_ref,omitempty" json:"epic_ref,omitempty"`
	GitHub    *GitHubSync `yaml:"github,omitempty" json:"github,omitempty"`
	GitLab    *GitLabSync `yaml:"gitlab,omitempty" json:"gitlab,omitempty"`
	Jira      *JiraSync   `yaml:"jira,omitempty" json:"jira,omitempty"`
	CreatedAt time.Time   `yaml:"created_at" json:"created_at"`
	UpdatedAt time.Time   `yaml:"updated_at" json:"updated_at"`
}

type Story struct {
	StoryFrontmatter `yaml:",inline"`
	Body             string `yaml:"-" json:"body"`
	FilePath         string `yaml:"-" json:"file_path"`
}
