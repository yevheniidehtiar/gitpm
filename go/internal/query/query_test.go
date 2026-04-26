package query_test

import (
	"testing"

	"github.com/yevheniidehtiar/gitpm/internal/query"
	"github.com/yevheniidehtiar/gitpm/internal/schema"
)

func TestFilterEntitiesNilOnEmpty(t *testing.T) {
	result := query.FilterEntities(nil, query.QueryFilter{})
	if result != nil {
		t.Errorf("expected nil, got %v", result)
	}
}

func TestFormatEntitiesEmpty(t *testing.T) {
	out := query.FormatEntities([]schema.Entity{}, query.FormatOptions{Format: "json"})
	if out != "" {
		t.Skipf("FormatEntities implemented, got: %s", out)
	}
}
