package schema

type EntityType string

const (
	EntityTypeStory     EntityType = "story"
	EntityTypeEpic      EntityType = "epic"
	EntityTypeMilestone EntityType = "milestone"
	EntityTypeRoadmap   EntityType = "roadmap"
	EntityTypePrd       EntityType = "prd"
)

type Entity interface {
	GetType() EntityType
	GetID() string
	GetTitle() string
	GetFilePath() string
}

func (s *Story) GetType() EntityType     { return EntityTypeStory }
func (s *Story) GetID() string           { return s.ID }
func (s *Story) GetTitle() string        { return s.Title }
func (s *Story) GetFilePath() string     { return s.FilePath }

func (e *Epic) GetType() EntityType      { return EntityTypeEpic }
func (e *Epic) GetID() string            { return e.ID }
func (e *Epic) GetTitle() string         { return e.Title }
func (e *Epic) GetFilePath() string      { return e.FilePath }

func (m *Milestone) GetType() EntityType { return EntityTypeMilestone }
func (m *Milestone) GetID() string       { return m.ID }
func (m *Milestone) GetTitle() string    { return m.Title }
func (m *Milestone) GetFilePath() string { return m.FilePath }

func (r *Roadmap) GetType() EntityType   { return EntityTypeRoadmap }
func (r *Roadmap) GetID() string         { return r.ID }
func (r *Roadmap) GetTitle() string      { return r.Title }
func (r *Roadmap) GetFilePath() string   { return r.FilePath }

func (p *Prd) GetType() EntityType       { return EntityTypePrd }
func (p *Prd) GetID() string             { return p.ID }
func (p *Prd) GetTitle() string          { return p.Title }
func (p *Prd) GetFilePath() string       { return p.FilePath }
