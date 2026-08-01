package extension

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"time"

	"veilbidding/internal/agents"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
)

// withAgentCORS lets the browser call these routes directly (they aren't
// routed through ext-proxy like /state and /action are — see New()).
func withAgentCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Agent-Signature, X-Agent-Timestamp")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

// verifyAgentAuth requires the request be signed (EIP-191 personal-sign, the
// same scheme the connected wallet already uses for everything else in this
// app) by the wallet the route acts on — otherwise anyone who merely knows a
// wallet's address (public on invite lists) could toggle, delete, or trigger
// someone else's agent. The signed message binds method+path+timestamp, so a
// signature can't be replayed against a different route and expires after 5
// minutes.
func verifyAgentAuth(r *http.Request, wallet common.Address) error {
	sigHex := r.Header.Get("X-Agent-Signature")
	tsHeader := r.Header.Get("X-Agent-Timestamp")
	if sigHex == "" || tsHeader == "" {
		return fmt.Errorf("missing X-Agent-Signature/X-Agent-Timestamp headers")
	}
	ts, err := strconv.ParseInt(tsHeader, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid X-Agent-Timestamp")
	}
	if diff := time.Now().Unix() - ts; diff > 300 || diff < -60 {
		return fmt.Errorf("stale or future-dated signature")
	}

	sig, err := hexutil.Decode(sigHex)
	if err != nil || len(sig) != 65 {
		return fmt.Errorf("invalid signature format")
	}
	if sig[64] >= 27 {
		sig[64] -= 27
	}

	message := fmt.Sprintf("VeilPayAgent:%s:%s:%d", r.Method, r.URL.Path, ts)
	pub, err := crypto.SigToPub(accounts.TextHash([]byte(message)), sig)
	if err != nil {
		return fmt.Errorf("recovering signer: %w", err)
	}
	if crypto.PubkeyToAddress(*pub) != wallet {
		return fmt.Errorf("signature does not match wallet")
	}
	return nil
}

func pathWallet(r *http.Request) (common.Address, error) {
	raw := r.PathValue("wallet")
	if !common.IsHexAddress(raw) {
		return common.Address{}, fmt.Errorf("invalid wallet address")
	}
	return common.HexToAddress(raw), nil
}

type createAgentRequest struct {
	Wallet              string `json:"wallet"`
	EncryptedPrivateKey string `json:"encryptedPrivateKey"`
	Keyword             string `json:"keyword"`
	ItemType            string `json:"itemType"`
	MaxAmount           string `json:"maxAmount"`
}

type updateAgentRequest struct {
	Active    *bool   `json:"active"`
	Keyword   *string `json:"keyword"`
	ItemType  *string `json:"itemType"`
	MaxAmount *string `json:"maxAmount"`
}

type agentResponse struct {
	Wallet          string `json:"wallet"`
	Keyword         string `json:"keyword"`
	ItemType        string `json:"itemType"`
	MaxAmount       string `json:"maxAmount"`
	Active          bool   `json:"active"`
	LastRunAt       string `json:"lastRunAt,omitempty"`
	LastOutcome     string `json:"lastOutcome,omitempty"`
	TotalBidsPlaced int    `json:"totalBidsPlaced"`
}

// toAgentResponse deliberately omits EncryptedPrivateKey — the ciphertext
// never needs to round-trip back to the browser once stored.
func toAgentResponse(r *agents.Record) agentResponse {
	return agentResponse{
		Wallet: r.Wallet, Keyword: r.Keyword, ItemType: r.ItemType,
		MaxAmount: r.MaxAmount, Active: r.Active,
		LastRunAt: r.LastRunAt, LastOutcome: r.LastOutcome,
		TotalBidsPlaced: r.TotalBidsPlaced,
	}
}

func writeAgentJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (e *Extension) agentCollectionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	e.createAgentHandler(w, r)
}

func (e *Extension) agentItemHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		e.getAgentHandler(w, r)
	case http.MethodPatch:
		e.updateAgentHandler(w, r)
	case http.MethodDelete:
		e.deleteAgentHandler(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// createAgentHandler registers this wallet's single v1 agent (or replaces it
// wholesale — the frontend only offers "create" while none exists). The
// stored key is ciphertext the browser already ECIES-encrypted to the TEE's
// public key; this process never sees it in the clear.
func (e *Extension) createAgentHandler(w http.ResponseWriter, r *http.Request) {
	var req createAgentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if !common.IsHexAddress(req.Wallet) {
		http.Error(w, "invalid wallet address", http.StatusBadRequest)
		return
	}
	wallet := common.HexToAddress(req.Wallet)
	if err := verifyAgentAuth(r, wallet); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	if req.EncryptedPrivateKey == "" {
		http.Error(w, "encryptedPrivateKey required", http.StatusBadRequest)
		return
	}
	if _, ok := new(big.Int).SetString(req.MaxAmount, 10); !ok {
		http.Error(w, "invalid maxAmount", http.StatusBadRequest)
		return
	}
	if e.agentStore == nil {
		http.Error(w, "agent store not configured", http.StatusServiceUnavailable)
		return
	}

	rec := &agents.Record{
		Wallet:              wallet.Hex(),
		EncryptedPrivateKey: req.EncryptedPrivateKey,
		Keyword:             req.Keyword,
		ItemType:            req.ItemType,
		MaxAmount:           req.MaxAmount,
		Active:              true,
	}
	if err := e.agentStore.Upsert(rec); err != nil {
		http.Error(w, "saving agent: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Fire the first evaluation pass immediately so registering doesn't mean
	// waiting a full day to see anything happen — the HTTP response doesn't
	// wait on it, "Run Now" / the next GET reflects the outcome once done.
	if e.agentWatcher != nil {
		go e.agentWatcher.RunOne(context.Background(), wallet.Hex()) //nolint:errcheck
	}

	writeAgentJSON(w, http.StatusCreated, toAgentResponse(rec))
}

// getAgentHandler is deliberately unauthenticated — it's a read-only status
// check (no key material in the response, see toAgentResponse) fired on every
// Agents page load, and requiring a wallet signature just to view status
// meant popping a signing prompt on every visit. Mutating routes below still
// require it.
func (e *Extension) getAgentHandler(w http.ResponseWriter, r *http.Request) {
	wallet, err := pathWallet(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if e.agentStore == nil {
		http.Error(w, "agent store not configured", http.StatusServiceUnavailable)
		return
	}
	rec := e.agentStore.Get(wallet.Hex())
	if rec == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeAgentJSON(w, http.StatusOK, toAgentResponse(rec))
}

func (e *Extension) updateAgentHandler(w http.ResponseWriter, r *http.Request) {
	wallet, err := pathWallet(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := verifyAgentAuth(r, wallet); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	if e.agentStore == nil {
		http.Error(w, "agent store not configured", http.StatusServiceUnavailable)
		return
	}
	existing := e.agentStore.Get(wallet.Hex())
	if existing == nil {
		http.Error(w, "no agent registered", http.StatusNotFound)
		return
	}

	var req updateAgentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.Keyword != nil {
		existing.Keyword = *req.Keyword
	}
	if req.ItemType != nil {
		existing.ItemType = *req.ItemType
	}
	if req.MaxAmount != nil {
		if _, ok := new(big.Int).SetString(*req.MaxAmount, 10); !ok {
			http.Error(w, "invalid maxAmount", http.StatusBadRequest)
			return
		}
		existing.MaxAmount = *req.MaxAmount
	}
	if req.Active != nil {
		existing.Active = *req.Active
	}

	if err := e.agentStore.Upsert(existing); err != nil {
		http.Error(w, "saving agent: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeAgentJSON(w, http.StatusOK, toAgentResponse(existing))
}

func (e *Extension) deleteAgentHandler(w http.ResponseWriter, r *http.Request) {
	wallet, err := pathWallet(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := verifyAgentAuth(r, wallet); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	if e.agentStore == nil {
		http.Error(w, "agent store not configured", http.StatusServiceUnavailable)
		return
	}
	if err := e.agentStore.Delete(wallet.Hex()); err != nil {
		http.Error(w, "deleting agent: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// runAgentHandler backs the "Run Now" button — synchronously evaluates this
// wallet's agent against every open listing and returns the outcome.
func (e *Extension) runAgentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	wallet, err := pathWallet(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := verifyAgentAuth(r, wallet); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	if e.agentWatcher == nil {
		http.Error(w, "agent watcher not configured", http.StatusServiceUnavailable)
		return
	}
	if err := e.agentWatcher.RunOne(r.Context(), wallet.Hex()); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeAgentJSON(w, http.StatusOK, toAgentResponse(e.agentStore.Get(wallet.Hex())))
}
