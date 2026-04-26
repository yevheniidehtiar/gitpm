package writer_test

import (
	"testing"

	"github.com/yevheniidehtiar/gitpm/internal/writer"
)

func TestToSlugPlaceholder(t *testing.T) {
	slug := writer.ToSlug("Hello World")
	if slug != "" {
		t.Skipf("ToSlug implemented, got: %s", slug)
	}
	t.Skip("ToSlug not yet implemented")
}
