package parser_test

import (
	"testing"

	"github.com/yevheniidehtiar/gitpm/internal/parser"
)

func TestParseTreeReturnsEmptyForMissingDir(t *testing.T) {
	tree, err := parser.ParseTree("/nonexistent/path")
	if err != nil {
		t.Fatalf("ParseTree returned unexpected error: %v", err)
	}
	if tree == nil {
		t.Fatal("expected non-nil MetaTree")
	}
	if len(tree.Stories)+len(tree.Epics)+len(tree.Milestones) != 0 {
		t.Error("expected empty tree for nonexistent directory")
	}
}
