package validator

import (
	"github.com/yevheniidehtiar/gitpm/internal/parser"
)

type ValidationError struct {
	FilePath string `json:"file_path"`
	Message  string `json:"message"`
	Code     string `json:"code"`
}

type ValidationWarning struct {
	FilePath string `json:"file_path"`
	Message  string `json:"message"`
	Code     string `json:"code"`
}

type ValidationResult struct {
	Valid    bool                `json:"valid"`
	Errors   []ValidationError  `json:"errors"`
	Warnings []ValidationWarning `json:"warnings"`
}

// ValidateTree runs all validation rules on a parsed tree.
func ValidateTree(tree *parser.MetaTree) *ValidationResult {
	// TODO: implement — duplicate IDs, circular deps, status consistency
	return &ValidationResult{Valid: true}
}
