package writer

import (
	"github.com/yevheniidehtiar/gitpm/internal/schema"
)

type CreateStoryOptions struct {
	Title    string          `json:"title"`
	Priority schema.Priority `json:"priority"`
	EpicRef  *schema.EntityRef `json:"epic_ref,omitempty"`
	Labels   []string        `json:"labels,omitempty"`
}

type CreateEpicOptions struct {
	Title        string            `json:"title"`
	Priority     schema.Priority   `json:"priority"`
	MilestoneRef *schema.EntityRef `json:"milestone_ref,omitempty"`
	Labels       []string          `json:"labels,omitempty"`
}

type CreateMilestoneOptions struct {
	Title      string  `json:"title"`
	TargetDate *string `json:"target_date,omitempty"`
}

type MoveOptions struct {
	StoryPath   string `json:"story_path"`
	TargetEpicID string `json:"target_epic_id"`
}

// WriteFile serializes an entity back to its YAML frontmatter + markdown file.
func WriteFile(entity schema.Entity) error {
	// TODO: implement — marshal frontmatter, combine with body, write to disk
	return nil
}

// ScaffoldMeta creates the initial .meta/ directory structure.
func ScaffoldMeta(root string) error {
	// TODO: implement — create epics/, stories/, roadmap/ dirs and template files
	return nil
}

// ToSlug converts a title to a filesystem-safe slug.
func ToSlug(title string) string {
	// TODO: implement — lowercase, replace spaces with hyphens, strip special chars
	return ""
}
