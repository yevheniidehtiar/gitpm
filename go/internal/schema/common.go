package schema

import "time"

type Status string

const (
	StatusBacklog    Status = "backlog"
	StatusTodo       Status = "todo"
	StatusInProgress Status = "in_progress"
	StatusInReview   Status = "in_review"
	StatusDone       Status = "done"
	StatusCancelled  Status = "cancelled"
)

type Priority string

const (
	PriorityCritical Priority = "critical"
	PriorityHigh     Priority = "high"
	PriorityMedium   Priority = "medium"
	PriorityLow      Priority = "low"
)

type EntityRef struct {
	ID   string `yaml:"id" json:"id"`
	Path string `yaml:"path,omitempty" json:"path,omitempty"`
}

type GitHubSync struct {
	IssueNumber   *int       `yaml:"issue_number,omitempty" json:"issue_number,omitempty"`
	ProjectItemID string     `yaml:"project_item_id,omitempty" json:"project_item_id,omitempty"`
	MilestoneID   *int       `yaml:"milestone_id,omitempty" json:"milestone_id,omitempty"`
	Repo          string     `yaml:"repo" json:"repo"`
	LastSyncHash  string     `yaml:"last_sync_hash,omitempty" json:"last_sync_hash,omitempty"`
	SyncedAt      *time.Time `yaml:"synced_at,omitempty" json:"synced_at,omitempty"`
}

type GitLabSync struct {
	IssueIID     *int       `yaml:"issue_iid,omitempty" json:"issue_iid,omitempty"`
	EpicIID      *int       `yaml:"epic_iid,omitempty" json:"epic_iid,omitempty"`
	MilestoneID  *int       `yaml:"milestone_id,omitempty" json:"milestone_id,omitempty"`
	ProjectID    int        `yaml:"project_id" json:"project_id"`
	BaseURL      string     `yaml:"base_url" json:"base_url"`
	LastSyncHash string     `yaml:"last_sync_hash,omitempty" json:"last_sync_hash,omitempty"`
	SyncedAt     *time.Time `yaml:"synced_at,omitempty" json:"synced_at,omitempty"`
}

type JiraSync struct {
	IssueKey     string     `yaml:"issue_key,omitempty" json:"issue_key,omitempty"`
	ProjectKey   string     `yaml:"project_key" json:"project_key"`
	SprintID     *int       `yaml:"sprint_id,omitempty" json:"sprint_id,omitempty"`
	Site         string     `yaml:"site" json:"site"`
	LastSyncHash string     `yaml:"last_sync_hash,omitempty" json:"last_sync_hash,omitempty"`
	SyncedAt     *time.Time `yaml:"synced_at,omitempty" json:"synced_at,omitempty"`
}

type Result[T any] struct {
	Ok    bool   `json:"ok"`
	Value T      `json:"value,omitempty"`
	Error string `json:"error,omitempty"`
}

func Ok[T any](value T) Result[T] {
	return Result[T]{Ok: true, Value: value}
}

func Err[T any](err error) Result[T] {
	return Result[T]{Ok: false, Error: err.Error()}
}
