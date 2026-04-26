package resolver_test

import (
	"testing"

	"github.com/yevheniidehtiar/gitpm/internal/parser"
	"github.com/yevheniidehtiar/gitpm/internal/resolver"
)

func TestResolveRefsEmptyTree(t *testing.T) {
	tree := &parser.MetaTree{}
	resolved, err := resolver.ResolveRefs(tree)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resolved == nil {
		t.Error("expected non-nil ResolvedTree")
	}
}

func TestBuildDependencyGraphEmpty(t *testing.T) {
	tree := &parser.MetaTree{}
	graph := resolver.BuildDependencyGraph(tree)
	if graph == nil {
		t.Error("expected non-nil DependencyGraph")
	}
	if len(graph.Adjacency) != 0 {
		t.Error("expected empty adjacency list")
	}
}
