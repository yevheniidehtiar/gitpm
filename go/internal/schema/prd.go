package schema

import "time"

type PrdFrontmatter struct {
	Type      EntityType  `yaml:"type" json:"type"`
	ID        string      `yaml:"id" json:"id"`
	Title     string      `yaml:"title" json:"title"`
	Status    Status      `yaml:"status" json:"status"`
	Owner     *string     `yaml:"owner,omitempty" json:"owner,omitempty"`
	EpicRefs  []EntityRef `yaml:"epic_refs,omitempty" json:"epic_refs,omitempty"`
	CreatedAt time.Time   `yaml:"created_at" json:"created_at"`
	UpdatedAt time.Time   `yaml:"updated_at" json:"updated_at"`
}

type Prd struct {
	PrdFrontmatter `yaml:",inline"`
	Body           string `yaml:"-" json:"body"`
	FilePath       string `yaml:"-" json:"file_path"`
}
