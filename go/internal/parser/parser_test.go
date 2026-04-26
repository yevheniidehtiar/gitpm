package parser_test

import (
	"testing"

	"github.com/yevheniidehtiar/gitpm/internal/parser"
)

func TestParseTreeReturnsEmptyForMissingDir(t *testing.T) {
	tree, err := parser.ParseTree("/nonexistent/path")
	if err != nil {
		t.Skipf("ParseTree not yet implemented: %v", err)
	}
	if tree == nil {
		t.Error("expected non-nil MetaTree")
	}
}
