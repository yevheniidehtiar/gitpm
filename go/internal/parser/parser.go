package parser

import (
	"fmt"

	"github.com/yevheniidehtiar/gitpm/internal/schema"
)

type ParseError struct {
	FilePath string `json:"file_path"`
	Message  string `json:"message"`
}

type MetaTree struct {
	Stories    []schema.Story     `json:"stories"`
	Epics      []schema.Epic      `json:"epics"`
	Milestones []schema.Milestone `json:"milestones"`
	Roadmaps   []schema.Roadmap   `json:"roadmaps"`
	Prds       []schema.Prd       `json:"prds"`
	Errors     []ParseError       `json:"errors"`
}

// ParseTree reads all entities from the .meta/ directory tree.
func ParseTree(root string) (*MetaTree, error) {
	// TODO: implement — walk root dir, parse frontmatter+YAML files into entities
	return &MetaTree{}, nil
}

// ParseFile parses a single markdown or YAML file into an entity.
func ParseFile(path string) (schema.Entity, error) {
	// TODO: implement — read file, detect format, parse frontmatter, validate
	return nil, fmt.Errorf("ParseFile not implemented")
}
