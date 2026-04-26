package schema

import "time"

type MilestoneFrontmatter struct {
	Type       string      `yaml:"type" json:"type"`
	ID         string      `yaml:"id" json:"id"`
	Title      string      `yaml:"title" json:"title"`
	TargetDate *string     `yaml:"target_date,omitempty" json:"target_date,omitempty"`
	Status     Status      `yaml:"status" json:"status"`
	GitHub     *GitHubSync `yaml:"github,omitempty" json:"github,omitempty"`
	GitLab     *GitLabSync `yaml:"gitlab,omitempty" json:"gitlab,omitempty"`
	Jira       *JiraSync   `yaml:"jira,omitempty" json:"jira,omitempty"`
	CreatedAt  time.Time   `yaml:"created_at" json:"created_at"`
	UpdatedAt  time.Time   `yaml:"updated_at" json:"updated_at"`
}

type Milestone struct {
	MilestoneFrontmatter `yaml:",inline"`
	Body                 string `yaml:"-" json:"body"`
	FilePath             string `yaml:"-" json:"file_path"`
}
