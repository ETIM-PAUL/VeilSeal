package extension

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strconv"

	"veilbidding/internal/agents"
	"veilbidding/internal/config"
	"veilbidding/pkg/types"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	"github.com/flare-foundation/go-flare-common/pkg/tee/structs"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"

	"github.com/flare-foundation/tee-node/pkg/processorutils"
)

// Extension holds a chain client alongside signPort - SCORE needs to read a
// wallet's on-chain signals and the listing's minScore directly; REVEAL still
// needs nothing beyond signPort since every sealed bid's ciphertext is carried
// inline in the instruction.
type Extension struct {
	Server *http.Server

	// signPort is the TEE node's /decrypt endpoint.
	signPort int

	// chainClient and instructionSender back the SCORE handler's on-chain
	// reads. Left nil if CHAIN_URL/INSTRUCTION_SENDER aren't set - REVEAL
	// keeps working regardless, SCORE requests just fail with a clear error.
	chainClient       *ethclient.Client
	instructionSender common.Address

	// agentStore/agentWatcher back the v1 auto-bidding agent (one per wallet,
	// invite-only or score-gated standard listings - see internal/agents).
	// Left nil under the same conditions as chainClient; the /agent routes
	// return a clear error instead of panicking if unconfigured.
	agentStore   *agents.Store
	agentWatcher *agents.Watcher
}

// --- DO NOT MODIFY: New(), actionHandler() are boilerplate.
func New(extensionPort, signPort int) *Extension {
	e := &Extension{signPort: signPort}

	if chainURL := os.Getenv("CHAIN_URL"); chainURL != "" {
		client, err := ethclient.Dial(chainURL)
		if err != nil {
			logger.Errorf("SCORE handler disabled: dial CHAIN_URL: %v", err)
		} else {
			e.chainClient = client
		}
	}
	if sender := os.Getenv("INSTRUCTION_SENDER"); sender != "" {
		e.instructionSender = common.HexToAddress(sender)
	}

	storePath := os.Getenv("AGENT_STORE_PATH")
	if storePath == "" {
		storePath = "./data/agents.json"
	}
	e.agentStore = agents.NewStore(storePath)

	if e.chainClient != nil {
		chainID := big.NewInt(114) // Coston2 default - matches docker-compose.coston2.yaml
		if v := os.Getenv("CHAIN_ID"); v != "" {
			if n, err := strconv.ParseInt(v, 10, 64); err == nil {
				chainID = big.NewInt(n)
			}
		}
		decrypt := func(ciphertext []byte) ([]byte, error) {
			return decryptViaNode(e.signPort, ciphertext)
		}
		e.agentWatcher = agents.NewWatcher(
			e.agentStore, e.chainClient, e.instructionSender, chainID, decrypt, os.Getenv("EXT_PROXY_URL"),
		)
		e.agentWatcher.Start(context.Background())
	} else {
		logger.Errorf("agent watcher disabled: missing CHAIN_URL")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /state", e.stateHandler)
	mux.HandleFunc("POST /action", e.actionHandler)

	// /agent* is called directly by the browser (not routed through ext-proxy
	// like /state and /action are) - published to the host separately (see
	// docker-compose.yaml's extension-tee port 7702) since it's a local-admin
	// API, not a public FCC-facing one. Needs its own CORS + method dispatch.
	mux.HandleFunc("/agent", withAgentCORS(e.agentCollectionHandler))
	mux.HandleFunc("/agent/{wallet}", withAgentCORS(e.agentItemHandler))
	mux.HandleFunc("/agent/{wallet}/run", withAgentCORS(e.runAgentHandler))

	// /stealth/{hashedId}/details is likewise called directly by the browser,
	// not routed through ext-proxy - it's a synchronous signed-request/
	// response exchange, not an FCC instruction, so it doesn't belong on the
	// /action path at all.
	mux.HandleFunc("/stealth/{hashedId}/details", withStealthCORS(e.stealthDetailsHandler))

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

	case dataFixed.OPType == teeutils.ToHash(config.OPTypeCipher):
		return e.processCipher(action, dataFixed)

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op type: received %s, expected %s (%s) or %s (%s)",
			dataFixed.OPType.Hex(),
			teeutils.ToHash(config.OPTypeBid).Hex(), config.OPTypeBid,
			teeutils.ToHash(config.OPTypeCipher).Hex(), config.OPTypeCipher,
		))
	}
}

// processCipher routes CIPHER instructions by OPCommand (currently just CIPHER_REVEAL).
func (e *Extension) processCipher(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandCipherReveal):
		ar := e.processCipherReveal(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op command: received %s, expected %s (%s)",
			df.OPCommand.Hex(),
			teeutils.ToHash(config.OPCommandCipherReveal).Hex(), config.OPCommandCipherReveal,
		))
	}
}

// processBid routes BID instructions by OPCommand (REVEAL or SCORE).
func (e *Extension) processBid(action teetypes.Action, df *instruction.DataFixed) (int, []byte) {
	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandReveal):
		ar := e.processBidReveal(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	case df.OPCommand == teeutils.ToHash(config.OPCommandScore):
		ar := e.processScoreCheck(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	case df.OPCommand == teeutils.ToHash(config.OPCommandMyScore):
		ar := e.processMyScore(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	case df.OPCommand == teeutils.ToHash(config.OPCommandStealthReveal):
		ar := e.processStealthBidReveal(action, df)
		b, _ := json.Marshal(ar)
		return http.StatusOK, b

	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op command: received %s, expected %s (%s), %s (%s), %s (%s), or %s (%s)",
			df.OPCommand.Hex(),
			teeutils.ToHash(config.OPCommandReveal).Hex(), config.OPCommandReveal,
			teeutils.ToHash(config.OPCommandScore).Hex(), config.OPCommandScore,
			teeutils.ToHash(config.OPCommandMyScore).Hex(), config.OPCommandMyScore,
			teeutils.ToHash(config.OPCommandStealthReveal).Hex(), config.OPCommandStealthReveal,
		))
	}
}

// processMyScore reads the requesting wallet's on-chain signals and returns
// its actual computed score - deliberately different from processScoreCheck,
// which only ever reveals a boolean. This is purely informational: the
// frontend polls the proxy directly and shows it only to that wallet, nothing
// is ever posted back on-chain, so there's no "someone else's score leaked"
// risk to guard against here.
func (e *Extension) processMyScore(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	if len(df.OriginalMessage) == 0 {
		return buildResult(action, df, nil, 0, fmt.Errorf("originalMessage is empty"))
	}
	if e.chainClient == nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("MY_SCORE handler not configured: missing CHAIN_URL"))
	}

	wallet, err := structs.Decode[common.Address](types.MyScoreMessageArg, df.OriginalMessage)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding my-score request: %v", err))
	}

	score, err := computeScore(context.Background(), e.chainClient, e.instructionSender, wallet)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("computing wallet score: %v", err))
	}

	encoded, err := types.MyScoreResultArgs.Pack(wallet, big.NewInt(int64(score)))
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("ABI encode my-score result: %v", err))
	}

	return buildResult(action, df, encoded, 1, nil)
}

// processScoreCheck reads the requesting wallet's on-chain signals (balance,
// tx count, prior sealed bids on this contract) and the listing's minScore -
// all independently from chain, never trusting caller input - computes a 0-100
// score, and additionally decrypts the bid's ciphertext to check its amount
// against minBid, all in the same round-trip so bidders don't need a third
// wallet pop beyond the existing check-then-seal flow. Score is checked first,
// then amount, so a failure clearly says which requirement wasn't met. Neither
// the score nor the bid amount ever leaves this function - only eligible/not.
func (e *Extension) processScoreCheck(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	if len(df.OriginalMessage) == 0 {
		return buildResult(action, df, nil, 0, fmt.Errorf("originalMessage is empty"))
	}
	if e.chainClient == nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("SCORE handler not configured: missing CHAIN_URL"))
	}

	req, err := structs.Decode[types.ScoreCheckRequest](types.ScoreCheckMessageArg, df.OriginalMessage)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding score check request: %v", err))
	}

	ctx := context.Background()

	minScore, err := listingMinScore(ctx, e.chainClient, e.instructionSender, req.ListingId)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("reading listing minScore: %v", err))
	}
	minBid, err := listingMinBid(ctx, e.chainClient, e.instructionSender, req.ListingId)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("reading listing minBid: %v", err))
	}

	score, err := computeScore(ctx, e.chainClient, e.instructionSender, req.Bidder)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("computing wallet score: %v", err))
	}
	if big.NewInt(int64(score)).Cmp(minScore) < 0 {
		return buildResult(action, df, nil, 0, fmt.Errorf("wallet score below required threshold"))
	}

	plaintext, err := decryptViaNode(e.signPort, req.EncryptedTerms)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decrypting bid terms: %v", err))
	}
	var terms types.SealedTerms
	if err := json.Unmarshal(plaintext, &terms); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding decrypted bid terms: %v", err))
	}
	commitment, err := types.TermsCommitment(terms)
	if err != nil || commitment != common.Hash(req.TermsCommitment) {
		return buildResult(action, df, nil, 0, fmt.Errorf("bid terms do not match commitment"))
	}
	if terms.Bidder != req.Bidder {
		return buildResult(action, df, nil, 0, fmt.Errorf("bid terms bidder mismatch"))
	}
	if terms.Amount == nil || terms.Amount.Cmp(minBid) < 0 {
		return buildResult(action, df, nil, 0, fmt.Errorf("bid amount below listing minimum"))
	}

	encoded, err := types.ScoreCheckResultArgs.Pack(req.ListingId, req.Bidder, req.TermsCommitment, true)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("ABI encode score result: %v", err))
	}

	return buildResult(action, df, encoded, 1, nil)
}

// processBidReveal ABI-decodes the RevealMessage, decrypts every sealed bid's
// ECIES ciphertext via the TEE node's /decrypt endpoint, verifies each
// decrypted bid against its on-chain commitment, and returns the winner -
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
			// A single bad/corrupt ciphertext shouldn't fail the whole reveal -
			// skip it and continue with the rest.
			continue
		}

		var terms types.SealedTerms
		if err := json.Unmarshal(plaintext, &terms); err != nil {
			continue
		}

		commitment, err := types.TermsCommitment(terms)
		if err != nil || commitment != req.TermsCommitments[i] {
			// Decrypted terms don't match what was committed on-chain - reject.
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

// processStealthBidReveal is processBidReveal's stealth-listing counterpart -
// identical decrypt/verify/pick-the-max logic, keyed by hashedId instead of
// listingId. The winner's address and winning amount become public exactly
// like a regular reveal; only the listing's title/description/minBid/etc.
// (encryptedDetails, never touched here) stay hidden, forever.
func (e *Extension) processStealthBidReveal(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	if len(df.OriginalMessage) == 0 {
		return buildResult(action, df, nil, 0, fmt.Errorf("originalMessage is empty"))
	}

	req, err := structs.Decode[types.StealthRevealRequest](types.StealthRevealMessageArg, df.OriginalMessage)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding stealth reveal request: %v", err))
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
			continue
		}

		var terms types.SealedTerms
		if err := json.Unmarshal(plaintext, &terms); err != nil {
			continue
		}

		commitment, err := types.TermsCommitment(terms)
		if err != nil || commitment != req.TermsCommitments[i] {
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

	encoded, err :=
		types.StealthRevealResultArgs.Pack(req.HashedId, req.ContractAddr, winner, big.NewInt(winningAmount))
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("ABI encode stealth reveal result: %v", err))
	}

	return buildResult(action, df, encoded, 1, nil)
}

// processCipherReveal ABI-decodes the CipherRevealMessage, generates a fresh
// random reordering of the word list (guaranteed to differ from the
// creator's original order), decrypts every sealed guess's ECIES ciphertext
// via the TEE node's /decrypt endpoint, verifies each decrypted guess
// against its on-chain commitment, and returns the closest match - the
// participant with the most position-matches against the true reordering.
// Ties go to whichever guesser reached that score first (strict `>`, not
// `>=`, over guessers in submission order - the same tiebreak idiom
// processBidReveal already uses for "highest bid wins"). Unlike a bid
// reveal, both the winner's own arrangement and the true arrangement are
// ABI-encoded into the result - no match-count field; the frontend diffs
// the two itself. Losing guesses never leave this function.
func (e *Extension) processCipherReveal(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	if len(df.OriginalMessage) == 0 {
		return buildResult(action, df, nil, 0, fmt.Errorf("originalMessage is empty"))
	}

	req, err := structs.Decode[types.CipherRevealRequest](types.CipherRevealMessageArg, df.OriginalMessage)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding cipher reveal request: %v", err))
	}

	n := len(req.Guessers)
	if n != len(req.GuessCommitments) || n != len(req.EncryptedGuesses) {
		return buildResult(action, df, nil, 0, fmt.Errorf("mismatched guessers/commitments/ciphertexts lengths"))
	}
	if n == 0 {
		return buildResult(action, df, nil, 0, fmt.Errorf("no sealed guesses to reveal"))
	}

	trueArrangement, err := randomDerangement(int(req.WordCount))
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("generating true arrangement: %v", err))
	}

	var (
		winner            = req.Guessers[0]
		winnerArrangement []uint8
		bestScore         = -1
		found             bool
	)

	for i := 0; i < n; i++ {
		plaintext, err := decryptViaNode(e.signPort, req.EncryptedGuesses[i])
		if err != nil {
			// A single bad/corrupt ciphertext shouldn't fail the whole reveal -
			// skip it and continue with the rest.
			continue
		}

		var guess types.SealedGuess
		if err := json.Unmarshal(plaintext, &guess); err != nil {
			continue
		}
		if len(guess.Arrangement) != len(trueArrangement) {
			continue
		}

		commitment, err := types.GuessCommitment(guess)
		if err != nil || commitment != req.GuessCommitments[i] {
			// Decrypted guess doesn't match what was committed on-chain - reject.
			continue
		}
		if guess.Guesser != req.Guessers[i] {
			continue
		}

		score := 0
		for pos := range trueArrangement {
			if guess.Arrangement[pos] == trueArrangement[pos] {
				score++
			}
		}

		if !found || score > bestScore {
			bestScore = score
			winner = req.Guessers[i]
			winnerArrangement = guess.Arrangement
			found = true
		}
	}

	if !found {
		return buildResult(action, df, nil, 0, fmt.Errorf("no valid sealed guesses after decryption"))
	}

	encoded, err :=
		types.CipherRevealResultArgs.Pack(req.ListingId, req.ContractAddr, winner, winnerArrangement, trueArrangement)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("ABI encode cipher reveal result: %v", err))
	}

	return buildResult(action, df, encoded, 1, nil)
}
