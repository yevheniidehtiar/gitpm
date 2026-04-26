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

func TestWriteFileReturnsNotImplemented(t *testing.T) {
	err := writer.WriteFile(nil)
	if err == nil {
		t.Fatal("expected error from unimplemented WriteFile")
	}
}

func TestScaffoldMetaReturnsNotImplemented(t *testing.T) {
	err := writer.ScaffoldMeta("/tmp/nonexistent")
	if err == nil {
		t.Fatal("expected error from unimplemented ScaffoldMeta")
	}
}
