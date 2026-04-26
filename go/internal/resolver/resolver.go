package resolver

import (
	"github.com/yevheniidehtiar/gitpm/internal/parser"
	"github.com/yevheniidehtiar/gitpm/internal/schema"
)

type ResolvedStory struct {
	schema.Story
	ResolvedEpic *schema.Epic `json:"resolved_epic,omitempty"`
}

type ResolvedEpic struct {
	schema.Epic
	ResolvedStories   []schema.Story     `json:"resolved_stories"`
	ResolvedMilestone *schema.Milestone  `json:"resolved_milestone,omitempty"`
}

type ResolvedMilestone struct {
	schema.Milestone
	ResolvedEpics []schema.Epic `json:"resolved_epics"`
}

type ResolvedRoadmap struct {
	schema.Roadmap
	ResolvedMilestones []schema.Milestone `json:"resolved_milestones"`
}

type ResolvedPrd struct {
	schema.Prd
	ResolvedEpics []schema.Epic `json:"resolved_epics"`
}

type ResolvedTree struct {
	Stories    []ResolvedStory    `json:"stories"`
	Epics      []ResolvedEpic     `json:"epics"`
	Milestones []ResolvedMilestone `json:"milestones"`
	Roadmaps   []ResolvedRoadmap  `json:"roadmaps"`
	Prds       []ResolvedPrd      `json:"prds"`
	Errors     []parser.ParseError `json:"errors"`
}

// DependencyGraph represents directed edges between entities.
type DependencyGraph struct {
	Adjacency map[string][]string
}

// ResolveRefs builds cross-references between entities.
func ResolveRefs(tree *parser.MetaTree) (*ResolvedTree, error) {
	// TODO: implement — build lookup maps, resolve refs, detect broken links
	return &ResolvedTree{}, nil
}

// BuildDependencyGraph creates a directed graph from entity references.
func BuildDependencyGraph(tree *parser.MetaTree) *DependencyGraph {
	// TODO: implement — adjacency list from epic_ref, milestone_ref, epic_refs
	return &DependencyGraph{Adjacency: make(map[string][]string)}
}
