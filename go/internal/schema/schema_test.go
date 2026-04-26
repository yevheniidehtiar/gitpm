package schema_test

import (
	"testing"

	"github.com/yevheniidehtiar/gitpm/internal/schema"
)

func TestStoryImplementsEntity(t *testing.T) {
	var _ schema.Entity = schema.Story{}
}

func TestEpicImplementsEntity(t *testing.T) {
	var _ schema.Entity = schema.Epic{}
}

func TestMilestoneImplementsEntity(t *testing.T) {
	var _ schema.Entity = schema.Milestone{}
}

func TestRoadmapImplementsEntity(t *testing.T) {
	var _ schema.Entity = schema.Roadmap{}
}

func TestPrdImplementsEntity(t *testing.T) {
	var _ schema.Entity = schema.Prd{}
}

func TestStatusConstants(t *testing.T) {
	statuses := []schema.Status{
		schema.StatusBacklog,
		schema.StatusTodo,
		schema.StatusInProgress,
		schema.StatusInReview,
		schema.StatusDone,
		schema.StatusCancelled,
	}
	for _, s := range statuses {
		if s == "" {
			t.Error("status constant is empty")
		}
	}
}

func TestResultOk(t *testing.T) {
	r := schema.Ok(42)
	if !r.Ok {
		t.Error("expected Ok to be true")
	}
	if r.Value != 42 {
		t.Errorf("expected Value=42, got %d", r.Value)
	}
}
