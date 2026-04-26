package writer_test

import (
	"testing"

	"github.com/yevheniidehtiar/gitpm/internal/writer"
)

func TestToSlugNotYetImplemented(t *testing.T) {
	slug := writer.ToSlug("Hello World")
	if slug != "" {
		t.Errorf("ToSlug stub should return empty string, got: %q", slug)
	}
}
