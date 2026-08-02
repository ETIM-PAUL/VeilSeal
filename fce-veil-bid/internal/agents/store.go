// Package agents holds the v1 auto-bidding agent: at most one per wallet,
// its private key stored only as ECIES ciphertext (the same scheme sealed bid
// terms already use), decrypted in memory for the length of a single signing
// operation and never persisted or logged in the clear.
package agents

import (
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Record is one wallet's agent configuration. EncryptedPrivateKey is hex
// ECIES ciphertext produced client-side against the TEE's published public
// key - this process only ever sees plaintext key material transiently,
// inside evaluateAgent, via decryptViaNode.
type Record struct {
	Wallet              string `json:"wallet"`
	EncryptedPrivateKey string `json:"encryptedPrivateKey"`
	Keyword             string `json:"keyword"`
	ItemType            string `json:"itemType"`
	MaxAmount           string `json:"maxAmount"`
	Active              bool   `json:"active"`
	LastRunAt           string `json:"lastRunAt,omitempty"`
	LastOutcome         string `json:"lastOutcome,omitempty"`
	TotalBidsPlaced     int    `json:"totalBidsPlaced"`
}

// MaxAmountBig parses MaxAmount as a base-10 chain-amount integer (same scale
// as Listing.minBid - see src/utils/sealedBid.js's AMOUNT_SCALE).
func (r *Record) MaxAmountBig() (*big.Int, error) {
	v, ok := new(big.Int).SetString(r.MaxAmount, 10)
	if !ok {
		return nil, fmt.Errorf("invalid maxAmount %q", r.MaxAmount)
	}
	return v, nil
}

// Store is a small JSON-file-backed table of Records keyed by lowercased
// wallet address. Good enough for a v1 cap of one agent per wallet; not
// intended to scale beyond a hackathon-sized user base.
type Store struct {
	mu   sync.Mutex
	path string
	data map[string]*Record
}

// NewStore opens (or lazily creates) the store at path.
func NewStore(path string) *Store {
	s := &Store{path: path, data: map[string]*Record{}}
	if b, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(b, &s.data)
	}
	return s
}

func normalize(wallet string) string {
	return strings.ToLower(strings.TrimSpace(wallet))
}

func (s *Store) saveLocked() error {
	if dir := filepath.Dir(s.path); dir != "." {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return err
		}
	}
	b, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, b, 0o600)
}

// Upsert creates or fully replaces the agent config for a wallet - v1 allows
// exactly one agent per wallet, so "create" and "update criteria" both land
// here; the caller decides whether Active should reset to true.
func (s *Store) Upsert(r *Record) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	r.Wallet = normalize(r.Wallet)
	s.data[r.Wallet] = r
	return s.saveLocked()
}

// Get returns the record for wallet, or nil if none exists.
func (s *Store) Get(wallet string) *Record {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.data[normalize(wallet)]
}

// SetActive toggles a wallet's agent on/off without touching its criteria.
func (s *Store) SetActive(wallet string, active bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.data[normalize(wallet)]
	if !ok {
		return fmt.Errorf("no agent registered for %s", wallet)
	}
	r.Active = active
	return s.saveLocked()
}

// Delete removes a wallet's agent entirely, including its key ciphertext.
func (s *Store) Delete(wallet string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, normalize(wallet))
	return s.saveLocked()
}

// RecordRun stamps the outcome of the most recent evaluation pass so the
// frontend can show "last run" status without the extension needing a
// separate events log.
func (s *Store) RecordRun(wallet, outcome string, placedCount int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.data[normalize(wallet)]
	if !ok {
		return
	}
	r.LastRunAt = time.Now().UTC().Format(time.RFC3339)
	r.LastOutcome = outcome
	r.TotalBidsPlaced += placedCount
	_ = s.saveLocked()
}

// All returns every stored record - used by the 24h ticker to sweep every
// registered agent in one pass.
func (s *Store) All() []*Record {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]*Record, 0, len(s.data))
	for _, r := range s.data {
		out = append(out, r)
	}
	return out
}
