package extension

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
)

// withStealthCORS lets the browser call this route directly (it isn't routed
// through ext-proxy like /state and /action are - see New()), mirroring
// withAgentCORS.
func withStealthCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Stealth-Signature, X-Stealth-Timestamp")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

// recoverStealthSigner verifies a signed, replay-protected request the same
// way verifyAgentAuth does (EIP-191 personal-sign, method+path+timestamp
// bound into the signed message, a tight expiry window) but returns the
// recovered address instead of checking it against a wallet the caller
// already claims via a path parameter - here the signature itself is the
// only thing establishing who's asking, since viewing a stealth listing's
// details has no separate "wallet" argument to verify against.
func recoverStealthSigner(r *http.Request) (common.Address, error) {
	sigHex := r.Header.Get("X-Stealth-Signature")
	tsHeader := r.Header.Get("X-Stealth-Timestamp")
	if sigHex == "" || tsHeader == "" {
		return common.Address{}, fmt.Errorf("missing X-Stealth-Signature/X-Stealth-Timestamp headers")
	}
	ts, err := strconv.ParseInt(tsHeader, 10, 64)
	if err != nil {
		return common.Address{}, fmt.Errorf("invalid X-Stealth-Timestamp")
	}
	if diff := time.Now().Unix() - ts; diff > 60 || diff < -10 {
		return common.Address{}, fmt.Errorf("stale or future-dated signature")
	}

	sig, err := hexutil.Decode(sigHex)
	if err != nil || len(sig) != 65 {
		return common.Address{}, fmt.Errorf("invalid signature format")
	}
	if sig[64] >= 27 {
		sig[64] -= 27
	}

	message := fmt.Sprintf("VeilPayStealth:%s:%s:%d", r.Method, r.URL.Path, ts)
	pub, err := crypto.SigToPub(accounts.TextHash([]byte(message)), sig)
	if err != nil {
		return common.Address{}, fmt.Errorf("recovering signer: %w", err)
	}
	return crypto.PubkeyToAddress(*pub), nil
}

// stealthDetailsHandler is the entire point of stealth listings: it lets a
// participant decrypt a listing's title/description/itemType/ipfsHash/minBid
// without any of it ever touching a transaction. The request and response are
// a plain, direct HTTP exchange - no instruction fee, no on-chain relay, no
// ActionResult polling - because nothing here needs a smart contract to later
// verify it happened. The plaintext exists only inside this process for the
// moment it takes to decrypt and write the response.
func (e *Extension) stealthDetailsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if e.chainClient == nil {
		http.Error(w, "stealth details handler not configured: missing CHAIN_URL", http.StatusServiceUnavailable)
		return
	}

	raw, err := hexutil.Decode(r.PathValue("hashedId"))
	if err != nil || len(raw) != 32 {
		http.Error(w, "invalid hashedId", http.StatusBadRequest)
		return
	}
	var hashedId [32]byte
	copy(hashedId[:], raw)

	signer, err := recoverStealthSigner(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	listing, err := readStealthListing(ctx, e.chainClient, e.instructionSender, hashedId)
	if err != nil {
		http.Error(w, "reading stealth listing: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if listing.Deadline == 0 {
		http.Error(w, "unknown listing", http.StatusNotFound)
		return
	}

	participant, err := isStealthParticipant(ctx, e.chainClient, e.instructionSender, hashedId, signer)
	if err != nil {
		http.Error(w, "checking participant status: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if !participant {
		http.Error(w, "not a participant of this stealth listing", http.StatusForbidden)
		return
	}

	plaintext, err := decryptViaNode(e.signPort, listing.EncryptedDetails)
	if err != nil {
		http.Error(w, "decrypting listing details: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// The decrypted JSON (title/description/itemType/ipfsHash/minBid/nonce)
	// is passed straight through - this process doesn't need to interpret
	// any of those fields itself, only the requesting participant's browser
	// does.
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(plaintext)
}
