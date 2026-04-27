package schema

import "time"

type Roadmap struct {
	Type        EntityType  `yaml:"type" json:"type"`
	ID          string      `yaml:"id" json:"id"`
	Title       string      `yaml:"title" json:"title"`
	Description string      `yaml:"description,omitempty" json:"description,omitempty"`
	Milestones  []EntityRef `yaml:"milestones,omitempty" json:"milestones,omitempty"`
	CreatedAt   time.Time   `yaml:"created_at,omitempty" json:"created_at,omitempty"`
	UpdatedAt   time.Time   `yaml:"updated_at,omitempty" json:"updated_at,omitempty"`
	FilePath    string      `yaml:"-" json:"file_path"`
}
