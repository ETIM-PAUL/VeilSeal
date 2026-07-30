package extension

import (
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"

	"veilbidding/internal/config"
	"veilbidding/pkg/types"

	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	"github.com/flare-foundation/go-flare-common/pkg/tee/structs"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"

	"github.com/flare-foundation/tee-node/pkg/processorutils"
)

// Extension is stateless — REVEAL carries every sealed bid's ciphertext
// inline, so there's nothing to remember between instructions.
type Extension struct {
	Server *http.Server

	// signPort is the TEE node's /decrypt endpoint.
	signPort int
}

// --- DO NOT MODIFY: New(), actionHandler() are boilerplate.
func New(extensionPort, signPort int) *Extension {
	e := &Extension{signPort: signPort}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /state", e.stateHandler)
	mux.HandleFunc("POST /action", e.actionHandler)

	e.Server = &http.Server{Addr: fmt.Sprintf(":%d", extensionPort), Handler: mux}
	return e
}

// stateHandler reports basic extension readiness.
func (e *Extension) stateHandler(w http.ResponseWriter, r *http.Request) {
	stateResponse := types.StateResponse{
		StateVersion: teeutils.ToHash(config.Version),
		State:        types.State{Ready: true},
	}

	err := json.NewEncoder(w).Encode(stateResponse)
	if err != nil {
		http.Error(w, fmt.Sprintf("sending response: %v", err), http.StatusInternalServerError)
		return
	}
}

// processAction parses the extension action and routes it to the appropriate processor.
func (e *Extension) processAction(action teetypes.Action) (int, []byte) {
	dataFixed, err := processorutils.Parse[instruction.DataFixed](action.Data.Message)
	if err != nil {
		return http.StatusBadRequest, []byte(fmt.Sprintf("decoding fixed data: %v", err))
	}

	switch {
	case dataFixed.OPType == teeutils.ToHash(config.OPTypeBid):
		return e.processBid(action, dataFixed)

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op type: received %s, expected %s (%s)",
			dataFixed.OPType.Hex(), teeutils.ToHash(config.OPTypeBid).Hex(), config.OPTypeBid,
		))
	}
}

// processBid routes BID instructions by OPCommand (currently just REVEAL).
func (e *Extension) processBid(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandReveal):
		ar := e.processBidReveal(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op command: received %s, expected %s (%s)",
			df.OPCommand.Hex(), teeutils.ToHash(config.OPCommandReveal).Hex(), config.OPCommandReveal,
		))
	}
}

// processBidReveal ABI-decodes the RevealMessage, decrypts every sealed bid's
// ECIES ciphertext via the TEE node's /decrypt endpoint, verifies each
// decrypted bid against its on-chain commitment, and returns the winner —
// the highest valid bid. Losing amounts never leave this function: only the
// winner and winning amount are ABI-encoded into the result.
func (e *Extension) processBidReveal(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	if len(df.OriginalMessage) == 0 {
		return buildResult(action, df, nil, 0, fmt.Errorf("originalMessage is empty"))
	}

	req, err := structs.Decode[types.RevealRequest](types.RevealMessageArg, df.OriginalMessage)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding reveal request: %v", err))
	}

	n := len(req.Bidders)
	if n != len(req.TermsCommitments) || n != len(req.EncryptedTerms) {
		return buildResult(action, df, nil, 0, fmt.Errorf("mismatched bidders/commitments/ciphertexts lengths"))
	}
	if n == 0 {
		return buildResult(action, df, nil, 0, fmt.Errorf("no sealed bids to reveal"))
	}

	var (
		winner        = req.Bidders[0]
		winningAmount int64
		found         bool
	)

	for i := 0; i < n; i++ {
		plaintext, err := decryptViaNode(e.signPort, req.EncryptedTerms[i])
		if err != nil {
			// A single bad/corrupt ciphertext shouldn't fail the whole reveal —
			// skip it and continue with the rest.
			continue
		}

		var terms types.SealedTerms
		if err := json.Unmarshal(plaintext, &terms); err != nil {
			continue
		}

		commitment, err := types.TermsCommitment(terms)
		if err != nil || commitment != req.TermsCommitments[i] {
			// Decrypted terms don't match what was committed on-chain — reject.
			continue
		}
		if terms.Bidder != req.Bidders[i] {
			continue
		}

		if terms.Amount != nil && terms.Amount.IsInt64() {
			amt := terms.Amount.Int64()
			if !found || amt > winningAmount {
				winningAmount = amt
				winner = req.Bidders[i]
				found = true
			}
		}
	}

	if !found {
		return buildResult(action, df, nil, 0, fmt.Errorf("no valid sealed bids after decryption"))
	}

	encoded, err := types.RevealResultArgs.Pack(req.ListingId, req.ContractAddr, winner, big.NewInt(winningAmount))
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("ABI encode reveal result: %v", err))
	}

	return buildResult(action, df, encoded, 1, nil)
}
