package schema

type Roadmap struct {
	Type        string      `yaml:"type" json:"type"`
	ID          string      `yaml:"id" json:"id"`
	Title       string      `yaml:"title" json:"title"`
	Description string      `yaml:"description,omitempty" json:"description,omitempty"`
	Milestones  []EntityRef `yaml:"milestones,omitempty" json:"milestones,omitempty"`
	UpdatedAt   string      `yaml:"updated_at,omitempty" json:"updated_at,omitempty"`
	FilePath    string      `yaml:"-" json:"file_path"`
}
