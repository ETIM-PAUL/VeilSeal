package support

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/joho/godotenv"
)

// ProjectRoot returns the veilbidding repo root (parent of tools/).
func ProjectRoot() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return ""
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", ".."))
}

// LoadProjectEnv loads .env from the repo root when present.
func LoadProjectEnv() {
	root := ProjectRoot()
	if root == "" {
		_ = godotenv.Load()
		return
	}
	path := filepath.Join(root, ".env")
	if err := godotenv.Load(path); err != nil && !os.IsNotExist(err) {
		_, _ = fmt.Fprintf(os.Stderr, "Warning: Error loading .env file: %v\n", err)
	}
}
