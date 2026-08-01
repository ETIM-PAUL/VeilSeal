package agents

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/crypto/ecies"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/flare-foundation/go-flare-common/pkg/logger"

	"veilbidding/pkg/types"
)

// marginBps is the v1 deterministic pricing heuristic: bid minBid plus this
// margin. Deliberately not an external AI call (see the agreed v1 plan) —
// fully confidential, no third-party dependency, no prompt/parsing surface.
const marginBps = 1000 // 10%

// Watcher evaluates every registered agent against currently open listings.
type Watcher struct {
	store             *Store
	chainClient       *ethclient.Client
	instructionSender common.Address
	chainID           *big.Int
	decrypt           func([]byte) ([]byte, error) // forwards to tee-node's local /decrypt
	extProxyURL       string

	// mu serializes every evaluation (the 24h ticker's sweep, "Run Now", and
	// the immediate first pass on registration can otherwise overlap) — two
	// concurrent runs for the same wallet raced the TEE's /decrypt endpoint
	// and each other's transaction nonce during testing. v1's scale (one
	// agent per wallet, a handful of listings) makes a single global lock
	// cheap; it just means runs queue up instead of interleaving.
	mu sync.Mutex
}

func NewWatcher(
	store *Store,
	chainClient *ethclient.Client,
	instructionSender common.Address,
	chainID *big.Int,
	decrypt func([]byte) ([]byte, error),
	extProxyURL string,
) *Watcher {
	return &Watcher{
		store:             store,
		chainClient:       chainClient,
		instructionSender: instructionSender,
		chainID:           chainID,
		decrypt:           decrypt,
		extProxyURL:       extProxyURL,
	}
}

// Start runs one evaluation pass immediately (so a freshly registered agent
// doesn't wait a full day to see anything happen), then every 24h thereafter.
// Runs until ctx is cancelled.
func (w *Watcher) Start(ctx context.Context) {
	go func() {
		w.RunAll(ctx)
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				w.RunAll(ctx)
			}
		}
	}()
}

// RunAll evaluates every active registered agent once.
func (w *Watcher) RunAll(ctx context.Context) {
	for _, r := range w.store.All() {
		if !r.Active {
			continue
		}
		w.runOne(ctx, r)
	}
}

// RunOne evaluates a single wallet's agent on demand — backs the "Run Now"
// button so registering/updating criteria is demoable without waiting a day.
func (w *Watcher) RunOne(ctx context.Context, wallet string) error {
	r := w.store.Get(wallet)
	if r == nil {
		return fmt.Errorf("no agent registered for %s", wallet)
	}
	if !r.Active {
		return fmt.Errorf("agent is inactive")
	}
	w.runOne(ctx, r)
	return nil
}

func (w *Watcher) runOne(ctx context.Context, r *Record) {
	w.mu.Lock()
	defer w.mu.Unlock()

	outcome, err := w.evaluate(ctx, r)
	if err != nil {
		logger.Errorf("agent %s: %v", r.Wallet, err)
		w.store.RecordRun(r.Wallet, "error: "+err.Error())
		return
	}
	w.store.RecordRun(r.Wallet, outcome)
}

func (w *Watcher) evaluate(ctx context.Context, r *Record) (string, error) {
	if w.chainClient == nil {
		return "", fmt.Errorf("watcher not configured: missing CHAIN_URL")
	}
	wallet := common.HexToAddress(r.Wallet)
	maxAmount, err := r.MaxAmountBig()
	if err != nil {
		return "", err
	}

	count, err := listingCount(ctx, w.chainClient, w.instructionSender)
	if err != nil {
		return "", fmt.Errorf("reading listingCount: %w", err)
	}

	placed, overBudget := 0, 0
	for i := int64(1); i <= count.Int64(); i++ {
		id := big.NewInt(i)
		listing, err := getListing(ctx, w.chainClient, w.instructionSender, id)
		if err != nil {
			logger.Errorf("agent %s: listing %d: reading listing: %v", r.Wallet, i, err)
			continue
		}
		if !w.matches(ctx, listing, id, wallet, r) {
			continue
		}

		bidAmount := heuristicBid(listing.MinBid)
		if bidAmount.Cmp(maxAmount) > 0 {
			// Per spec: if the recommended amount exceeds the wallet's max,
			// skip the listing entirely rather than clamping to the max.
			overBudget++
			continue
		}

		if err := w.placeBid(ctx, wallet, r, id, bidAmount); err != nil {
			logger.Errorf("agent %s: listing %d: %v", r.Wallet, i, err)
			continue
		}
		placed++
	}

	return fmt.Sprintf("bids placed: %d, skipped (over max amount): %d", placed, overBudget), nil
}

func (w *Watcher) matches(ctx context.Context, listing *Listing, id *big.Int, wallet common.Address, r *Record) bool {
	if !listing.InviteOnly || listing.Revealed {
		logger.Infof("agent %s: listing %s: skip (inviteOnly=%v revealed=%v)", r.Wallet, id, listing.InviteOnly, listing.Revealed)
		return false
	}
	if uint64(time.Now().Unix()) >= listing.Deadline {
		logger.Infof("agent %s: listing %s: skip (deadline passed)", r.Wallet, id)
		return false
	}

	invited, err := isParticipant(ctx, w.chainClient, w.instructionSender, id, wallet)
	if err != nil {
		logger.Errorf("agent %s: listing %s: isParticipant: %v", r.Wallet, id, err)
		return false
	}
	if !invited {
		logger.Infof("agent %s: listing %s: skip (not invited)", r.Wallet, id)
		return false
	}
	already, err := alreadyBid(ctx, w.chainClient, w.instructionSender, id, wallet)
	if err != nil {
		logger.Errorf("agent %s: listing %s: sealedBids: %v", r.Wallet, id, err)
		return false
	}
	if already {
		logger.Infof("agent %s: listing %s: skip (already bid)", r.Wallet, id)
		return false
	}
	if r.Keyword != "" && !strings.Contains(strings.ToLower(listing.Title), strings.ToLower(r.Keyword)) {
		logger.Infof("agent %s: listing %s: skip (keyword %q not in title %q)", r.Wallet, id, r.Keyword, listing.Title)
		return false
	}
	if r.ItemType != "" && !strings.EqualFold(listing.ItemType, r.ItemType) {
		logger.Infof("agent %s: listing %s: skip (itemType %q != %q)", r.Wallet, id, listing.ItemType, r.ItemType)
		return false
	}
	return true
}

// heuristicBid is the v1 pricing rule: minBid plus a fixed margin. No AI call.
func heuristicBid(minBid *big.Int) *big.Int {
	margin := new(big.Int).Mul(minBid, big.NewInt(marginBps))
	margin.Div(margin, big.NewInt(10000))
	return new(big.Int).Add(minBid, margin)
}

// placeBid decrypts the wallet's stored key just long enough to sign one
// transaction, then scrubs it — the plaintext key never touches disk and
// isn't retained in the Record.
func (w *Watcher) placeBid(ctx context.Context, wallet common.Address, r *Record, listingId, amount *big.Int) error {
	ciphertext, err := hex.DecodeString(strings.TrimPrefix(r.EncryptedPrivateKey, "0x"))
	if err != nil {
		return fmt.Errorf("decoding stored key ciphertext: %w", err)
	}
	plaintext, err := w.decrypt(ciphertext)
	if err != nil {
		return fmt.Errorf("decrypting stored key: %w", err)
	}
	keyHex := strings.TrimPrefix(strings.TrimSpace(string(plaintext)), "0x")
	key, err := crypto.HexToECDSA(keyHex)
	if err != nil {
		return fmt.Errorf("parsing decrypted key: %w", err)
	}
	defer scrub(key)

	if crypto.PubkeyToAddress(key.PublicKey) != wallet {
		return fmt.Errorf("stored key does not match registered wallet %s", wallet.Hex())
	}

	var nonceBytes [32]byte
	if _, err := rand.Read(nonceBytes[:]); err != nil {
		return err
	}
	terms := types.SealedTerms{Amount: amount, Nonce: common.BytesToHash(nonceBytes[:]), Bidder: wallet}
	termsCommitment, err := types.TermsCommitment(terms)
	if err != nil {
		return fmt.Errorf("computing terms commitment: %w", err)
	}
	plaintextTerms, err := json.Marshal(terms)
	if err != nil {
		return err
	}

	teePub, err := fetchTeePublicKey(w.extProxyURL)
	if err != nil {
		return fmt.Errorf("fetching TEE public key: %w", err)
	}
	encryptedTerms, err := ecies.Encrypt(rand.Reader, teePub, plaintextTerms, nil, nil)
	if err != nil {
		return fmt.Errorf("encrypting bid terms: %w", err)
	}

	txHash, err := submitSealedBidAs(ctx, w.chainClient, w.instructionSender, w.chainID, key, listingId, [32]byte(termsCommitment), encryptedTerms)
	if err != nil {
		return fmt.Errorf("submitSealedBid: %w", err)
	}
	logger.Infof("agent %s: bid submitted on listing %s, tx %s", r.Wallet, listingId, txHash.Hex())
	return nil
}

// scrub best-effort zeroes the private key's backing words. Go's GC may have
// already copied the value elsewhere by this point — this reduces the window
// the plaintext key sits in memory, it doesn't guarantee erasure.
func scrub(key *ecdsa.PrivateKey) {
	if key == nil || key.D == nil {
		return
	}
	words := key.D.Bits()
	for i := range words {
		words[i] = 0
	}
}
