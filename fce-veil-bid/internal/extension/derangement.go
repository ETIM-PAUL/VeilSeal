package extension

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// randomDerangement returns a Fisher-Yates-shuffled permutation of [0, n)
// via crypto/rand, retried if it happens to exactly equal the identity
// permutation - matches the product guarantee "always differs from the
// creator's original word order," not the stricter combinatorial
// derangement property (no fixed points at all).
func randomDerangement(n int) ([]uint8, error) {
	if n <= 0 || n > 255 {
		return nil, fmt.Errorf("invalid word count %d", n)
	}

	for attempt := 0; attempt < 100; attempt++ {
		perm := make([]uint8, n)
		for i := range perm {
			perm[i] = uint8(i)
		}
		for i := n - 1; i > 0; i-- {
			jBig, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
			if err != nil {
				return nil, fmt.Errorf("crypto/rand: %w", err)
			}
			j := jBig.Int64()
			perm[i], perm[j] = perm[j], perm[i]
		}
		if !isIdentityPermutation(perm) {
			return perm, nil
		}
	}

	return nil, fmt.Errorf("failed to generate non-identity permutation after 100 attempts")
}

func isIdentityPermutation(perm []uint8) bool {
	for i, v := range perm {
		if int(v) != i {
			return false
		}
	}
	return true
}
