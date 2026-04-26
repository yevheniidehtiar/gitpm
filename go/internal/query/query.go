package query

import (
	"github.com/yevheniidehtiar/gitpm/internal/schema"
)

type QueryFilter struct {
	Type     *schema.EntityType `json:"type,omitempty"`
	Status   *schema.Status     `json:"status,omitempty"`
	Priority *schema.Priority   `json:"priority,omitempty"`
	Labels   []string           `json:"labels,omitempty"`
	EpicID   *string            `json:"epic_id,omitempty"`
	Assignee *string            `json:"assignee,omitempty"`
	Text     *string            `json:"text,omitempty"`
}

type FormatOptions struct {
	Format string `json:"format"` // "table", "json", "csv"
}

// FilterEntities applies filters to a list of entities.
func FilterEntities(entities []schema.Entity, filter QueryFilter) []schema.Entity {
	// TODO: implement — match against filter fields
	return nil
}

// FormatEntities renders entities in the requested output format.
func FormatEntities(entities []schema.Entity, opts FormatOptions) string {
	// TODO: implement — table/json/csv formatting
	return ""
}
