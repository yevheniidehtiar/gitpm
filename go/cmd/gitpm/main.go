package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "gitpm",
	Short: "Git-native project management",
	Long:  "GitPM turns a Git repo's .meta/ directory into a full project management system, synchronized with GitHub.",
}

var validateCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate the .meta/ tree",
	RunE: func(cmd *cobra.Command, args []string) error {
		// TODO: implement — parseTree → resolveRefs → validateTree
		fmt.Println("validate: not yet implemented")
		return nil
	},
}

var queryCmd = &cobra.Command{
	Use:   "query",
	Short: "Query and filter entities",
	RunE: func(cmd *cobra.Command, args []string) error {
		// TODO: implement — parseTree → filterEntities → formatEntities
		fmt.Println("query: not yet implemented")
		return nil
	},
}

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize a .meta/ directory",
	RunE: func(cmd *cobra.Command, args []string) error {
		// TODO: implement — scaffoldMeta
		fmt.Println("init: not yet implemented")
		return nil
	},
}

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Bidirectional sync with GitHub",
	RunE: func(cmd *cobra.Command, args []string) error {
		// TODO: implement in Phase 2
		fmt.Println("sync: not yet implemented (Phase 2)")
		return nil
	},
}

var pushCmd = &cobra.Command{
	Use:   "push",
	Short: "Push .meta/ changes to GitHub",
	RunE: func(cmd *cobra.Command, args []string) error {
		// TODO: implement in Phase 2
		fmt.Println("push: not yet implemented (Phase 2)")
		return nil
	},
}

var pullCmd = &cobra.Command{
	Use:   "pull",
	Short: "Pull changes from GitHub into .meta/",
	RunE: func(cmd *cobra.Command, args []string) error {
		// TODO: implement in Phase 2
		fmt.Println("pull: not yet implemented (Phase 2)")
		return nil
	},
}

func init() {
	rootCmd.AddCommand(validateCmd)
	rootCmd.AddCommand(queryCmd)
	rootCmd.AddCommand(initCmd)
	rootCmd.AddCommand(syncCmd)
	rootCmd.AddCommand(pushCmd)
	rootCmd.AddCommand(pullCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
