package validator_test

import (
	"testing"

	"github.com/yevheniidehtiar/gitpm/internal/parser"
	"github.com/yevheniidehtiar/gitpm/internal/validator"
)

func TestValidateEmptyTreeIsValid(t *testing.T) {
	tree := &parser.MetaTree{}
	result := validator.ValidateTree(tree)
	if !result.Valid {
		t.Error("expected empty tree to be valid")
	}
}
