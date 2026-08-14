// Score-gated listing support: mirrors src/lib/tee/eligibility.js and
// src/lib/tee/proxy.js's pollActionResult exactly, so a score-gated listing
// gets the same private, TEE-verified eligibility check an agent's key would
// get if a human were bidding through the browser - the agent never learns
// its own wallet's score, only pass/fail, same as the frontend.
package agents

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
)

// actionResult mirrors ext-proxy's GET /action/result/:id response shape
// (see src/lib/tee/proxy.js's pollActionResult doc comment).
type actionResult struct {
	Result struct {
		Data          string `json:"data"`
		Id            string `json:"id"`
		SubmissionTag string `json:"submissionTag"`
		Status        int    `json:"status"`
		Log           string `json:"log"`
	} `json:"result"`
	Signature string `json:"signature"`
}

// pollActionResult polls ext-proxy for a completed ActionResult, mirroring
// proxy.js's pollActionResult: 404 and status=2 ("still processing") both
// mean "keep waiting"; any other non-200 is a real error.
func pollActionResult(proxyURL, instructionId string) (*actionResult, error) {
	url := strings.TrimRight(proxyURL, "/") + "/action/result/" + strings.TrimPrefix(instructionId, "0x")
	deadline := time.Now().Add(120 * time.Second)

	for {
		result, retry, err := fetchActionResultOnce(url)
		if err != nil {
			return nil, err
		}
		if !retry {
			return result, nil
		}
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("timed out waiting for instruction %s", instructionId)
		}
		time.Sleep(2 * time.Second)
	}
}

func fetchActionResultOnce(url string) (result *actionResult, retry bool, err error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, true, nil
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, false, fmt.Errorf("action result returned %d: %s", resp.StatusCode, body)
	}

	var body actionResult
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, false, err
	}
	if body.Result.Status == 2 { // still processing
		return nil, true, nil
	}
	return &body, false, nil
}

// requestEligibilityAttestation mirrors eligibility.js's
// requestEligibilityAttestation: sends requestScoreCheck bound to this exact
// termsCommitment/encryptedTerms pair, polls ext-proxy for the TEE's signed
// verdict, and returns it ready to pass into submitSealedBid. Returns an
// error if the TEE reports the wallet ineligible (score or bid amount below
// the listing's threshold) or if anything about the round-trip fails.
func (w *Watcher) requestEligibilityAttestation(
	ctx context.Context,
	key *ecdsa.PrivateKey,
	listingId *big.Int,
	termsCommitment [32]byte,
	encryptedTerms []byte,
) (attestationT, error) {
	if w.extProxyURL == "" {
		return attestationT{}, fmt.Errorf("EXT_PROXY_URL not configured")
	}

	instructionId, err := requestScoreCheckTx(ctx, w.chainClient, w.instructionSender, w.chainID, key, listingId, termsCommitment, encryptedTerms)
	if err != nil {
		return attestationT{}, fmt.Errorf("requestScoreCheck: %w", err)
	}

	result, err := pollActionResult(w.extProxyURL, instructionId.Hex())
	if err != nil {
		return attestationT{}, fmt.Errorf("polling score check result: %w", err)
	}
	if result.Result.Status != 1 {
		msg := result.Result.Log
		if msg == "" {
			msg = "TEE reported failure"
		}
		return attestationT{}, fmt.Errorf("%s", msg)
	}

	data, err := hexutil.Decode(result.Result.Data)
	if err != nil {
		return attestationT{}, fmt.Errorf("decoding attestation data: %w", err)
	}
	actionIdBytes, err := hexutil.Decode(result.Result.Id)
	if err != nil || len(actionIdBytes) != 32 {
		return attestationT{}, fmt.Errorf("decoding action id: %w", err)
	}
	signature, err := hexutil.Decode(result.Signature)
	if err != nil {
		return attestationT{}, fmt.Errorf("decoding signature: %w", err)
	}

	return attestationT{
		Data:          data,
		ActionId:      common.BytesToHash(actionIdBytes),
		SubmissionTag: result.Result.SubmissionTag,
		Status:        uint8(result.Result.Status),
		Signature:     signature,
	}, nil
}
