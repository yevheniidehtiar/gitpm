package schema

import "time"

type EpicFrontmatter struct {
	Type         string      `yaml:"type" json:"type"`
	ID           string      `yaml:"id" json:"id"`
	Title        string      `yaml:"title" json:"title"`
	Status       Status      `yaml:"status" json:"status"`
	Priority     Priority    `yaml:"priority" json:"priority"`
	Owner        *string     `yaml:"owner,omitempty" json:"owner,omitempty"`
	Labels       []string    `yaml:"labels,omitempty" json:"labels,omitempty"`
	MilestoneRef *EntityRef  `yaml:"milestone_ref,omitempty" json:"milestone_ref,omitempty"`
	GitHub       *GitHubSync `yaml:"github,omitempty" json:"github,omitempty"`
	GitLab       *GitLabSync `yaml:"gitlab,omitempty" json:"gitlab,omitempty"`
	Jira         *JiraSync   `yaml:"jira,omitempty" json:"jira,omitempty"`
	CreatedAt    time.Time   `yaml:"created_at" json:"created_at"`
	UpdatedAt    time.Time   `yaml:"updated_at" json:"updated_at"`
}

type Epic struct {
	EpicFrontmatter `yaml:",inline"`
	Body            string `yaml:"-" json:"body"`
	FilePath        string `yaml:"-" json:"file_path"`
}
