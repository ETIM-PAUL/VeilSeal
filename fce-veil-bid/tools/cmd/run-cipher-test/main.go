// Package main runs the Cipher Listing end-to-end demo:
//  1. setExtensionId on the deployed VeilBidding contract (idempotent)
//  2. register the TEE signing address (read from the proxy)
//  3. create a cipher listing (item metadata + a 12-word list)
//  4. submit a sealed guess (on-chain commitment + ECIES ciphertext)
//  5. wait for the deadline, then keeper: request reveal -> poll the TEE -> relay the signed result
//  6. assert the listing revealed with the expected winner, and that the
//     winner's stored arrangement matches what was submitted while the
//     TEE's true arrangement is a valid, non-identity permutation
package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"flag"
	"math/big"
	"os"
	"strings"
	"time"

	"veilbidding/pkg/types"
	"veilbidding/tools/pkg/configs"
	"veilbidding/tools/pkg/contracts/veilbidding"
	"veilbidding/tools/pkg/fccutils"
	"veilbidding/tools/pkg/support"
	instrutils "veilbidding/tools/pkg/utils"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	"github.com/pkg/errors"
)

func main() {
	af := flag.String("a", configs.AddressesFile, "file with deployed addresses")
	cf := flag.String("c", configs.ChainNodeURL, "chain node url")
	pf := flag.String("p", configs.ExtensionProxyURL, "extension proxy url")
	contractF := flag.String("instructionSender", os.Getenv("INSTRUCTION_SENDER"), "VeilBidding contract address")
	deadlineSecsF := flag.Int64("deadlineSecs", 30, "seconds from now until the listing deadline")
	flag.Parse()

	if *contractF == "" {
		logger.Fatal("--instructionSender flag is required (or set INSTRUCTION_SENDER in .env)")
	}
	contractAddr := common.HexToAddress(*contractF)

	s, err := support.DefaultSupport(*af, *cf)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	guesser := crypto.PubkeyToAddress(s.Prv.PublicKey)

	c, err := veilbidding.NewVeilBidding(contractAddr, s.ChainClient)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("bind contract: %s", err))
	}

	// --- Step 1: setExtensionId ---
	logger.Infof("Step 1: Setting extension ID...")
	if err := instrutils.SetExtensionId(s, contractAddr); err != nil {
		if strings.Contains(err.Error(), "Extension ID already set") {
			logger.Infof("  Extension ID already set (pre-build already registered it).")
		} else {
			fccutils.FatalWithCause(errors.Errorf("setExtensionId failed - is the extension registered (pre-build)? %s", err))
		}
	} else {
		logger.Infof("  Extension ID set.")
	}

	// --- Step 2: register the TEE signing address ---
	logger.Infof("Step 2: Registering TEE signing address...")
	info, err := fccutils.TeeInfo(*pf)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("fetch TEE info: %s", err))
	}
	teeAddr, _, err := fccutils.TeeProxyId(info)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("derive TEE address: %s", err))
	}
	logger.Infof("  TEE address: %s", teeAddr.Hex())
	if err := instrutils.SetTeeAddress(s, contractAddr, teeAddr); err != nil {
		fccutils.FatalWithCause(errors.Errorf("setTeeAddress: %s", err))
	}

	// --- Step 3: create a cipher listing ---
	deadline := uint64(time.Now().Unix() + *deadlineSecsF)
	logger.Infof("Step 3: Creating cipher listing (deadline in %ds)...", *deadlineSecsF)
	words := []string{
		"ocean", "lantern", "gravity", "orchid", "signal", "cinder",
		"harbor", "quartz", "meadow", "velvet", "cipher", "compass",
	}
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("create transactor: %s", err))
	}
	tx, err := c.CreateCipherListing(
		opts, "E2E Test Prize", "Created by tools/cmd/run-cipher-test", "file", "",
		words, deadline, []common.Address{guesser},
	)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("createCipherListing: %s", err))
	}
	receipt, err := bind.WaitMined(context.Background(), s.ChainClient, tx)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("wait createCipherListing: %s", err))
	}
	if receipt.Status != 1 {
		fccutils.FatalWithCause(errors.New("createCipherListing failed"))
	}
	listingId, err := c.CipherListingCount(&bind.CallOpts{})
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("cipherListingCount: %s", err))
	}
	logger.Infof("  Cipher listing #%s created (tx %s)", listingId, tx.Hash().Hex())

	// --- Step 4: submit a sealed guess ---
	logger.Infof("Step 4: Sealing a guess for listing #%s...", listingId)

	var nonceBytes [32]byte
	if _, err := rand.Read(nonceBytes[:]); err != nil {
		fccutils.FatalWithCause(errors.Errorf("generate nonce: %s", err))
	}
	nonce := common.Hash(nonceBytes)

	// Arbitrary reversed-order guess - what it actually is doesn't matter for
	// this test (only one guesser exists, so it wins regardless of score),
	// only that it round-trips correctly through encryption, decryption,
	// commitment verification, and on-chain storage.
	guess := types.SealedGuess{
		Arrangement: []uint8{11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0},
		Nonce:       nonce,
		Guesser:     guesser,
	}
	commitment, err := types.GuessCommitment(guess)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("compute guess commitment: %s", err))
	}

	pub, err := fccutils.TeeECIESPublicKey(*pf)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("fetch TEE public key: %s", err))
	}
	plaintext, err := json.Marshal(guess)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("encode sealed guess: %s", err))
	}
	ciphertext, err := fccutils.EncryptForTee(pub, plaintext)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("encrypt sealed guess: %s", err))
	}

	guessOpts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("create transactor: %s", err))
	}
	guessTx, err := c.SubmitCipherGuess(guessOpts, listingId, [32]byte(commitment), ciphertext)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("submitCipherGuess: %s", err))
	}
	guessReceipt, err := bind.WaitMined(context.Background(), s.ChainClient, guessTx)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("wait submitCipherGuess: %s", err))
	}
	if guessReceipt.Status != 1 {
		fccutils.FatalWithCause(errors.New("submitCipherGuess failed"))
	}
	logger.Infof("  Sealed guess submitted (tx %s)", guessTx.Hash().Hex())

	// --- Step 5: wait for the deadline, then keeper reveals ---
	wait := time.Until(time.Unix(int64(deadline), 0)) + 5*time.Second
	if wait > 0 {
		logger.Infof("Step 5: Waiting %s for the deadline to pass...", wait)
		time.Sleep(wait)
	}

	logger.Infof("  Revealing cipher listing #%s (keeper)...", listingId)
	relayTx, resp, err := requestAndRelayCipherReveal(s, c, contractAddr, *pf, listingId)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("cipher reveal: %s", err))
	}
	logger.Infof("  TEE result data: %s", resp.Result.Data.String())
	logger.Infof("  Relay tx: %s", relayTx.Hex())

	// --- Step 6: verify outcome ---
	logger.Infof("Step 6: Reading revealed cipher listing...")
	l, err := c.CipherListings(&bind.CallOpts{}, listingId)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("read cipher listing: %s", err))
	}
	winnerArrangement, err := c.GetCipherWinnerArrangement(&bind.CallOpts{}, listingId)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("read winner arrangement: %s", err))
	}
	trueArrangement, err := c.GetCipherTrueArrangement(&bind.CallOpts{}, listingId)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("read true arrangement: %s", err))
	}

	logger.Infof("  revealed=%v winner=%s winnerArrangement=%v trueArrangement=%v", l.Revealed, l.Winner.Hex(), winnerArrangement, trueArrangement)

	if !l.Revealed {
		fccutils.FatalWithCause(errors.New("FAIL: listing not revealed"))
	}
	if l.Winner != guesser {
		fccutils.FatalWithCause(errors.Errorf("FAIL: winner %s != expected guesser %s", l.Winner.Hex(), guesser.Hex()))
	}
	if len(winnerArrangement) != len(guess.Arrangement) {
		fccutils.FatalWithCause(errors.Errorf("FAIL: winnerArrangement length %d != submitted %d", len(winnerArrangement), len(guess.Arrangement)))
	}
	for i, v := range winnerArrangement {
		if v != guess.Arrangement[i] {
			fccutils.FatalWithCause(errors.Errorf("FAIL: winnerArrangement[%d]=%d != submitted %d", i, v, guess.Arrangement[i]))
		}
	}
	if len(trueArrangement) != 12 {
		fccutils.FatalWithCause(errors.Errorf("FAIL: trueArrangement length %d != 12", len(trueArrangement)))
	}
	isIdentity := true
	for i, v := range trueArrangement {
		if int(v) != i {
			isIdentity = false
			break
		}
	}
	if isIdentity {
		fccutils.FatalWithCause(errors.New("FAIL: trueArrangement equals identity permutation - derangement guarantee violated"))
	}

	logger.Infof("  ✓ Cipher listing #%s revealed - winner %s, arrangement matches the sealed guess, true arrangement is a valid non-identity permutation.", listingId, l.Winner.Hex())
	logger.Infof("All tests passed.")
}

// requestAndRelayCipherReveal mirrors instrutils.RequestAndRelayReveal, using
// the Cipher-specific contract methods.
func requestAndRelayCipherReveal(
	s *support.Support, c *veilbidding.VeilBidding, contractAddr common.Address, proxyURL string, listingId *big.Int,
) (common.Hash, *teetypes.ActionResponse, error) {
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return common.Hash{}, nil, errors.Errorf("create transactor: %s", err)
	}
	opts.Value = instrutils.DefaultFee

	tx, err := c.RequestCipherReveal(opts, listingId)
	if err != nil {
		return common.Hash{}, nil, errors.Errorf("requestCipherReveal: %s", err)
	}
	receipt, err := bind.WaitMined(context.Background(), s.ChainClient, tx)
	if err != nil {
		return common.Hash{}, nil, errors.Errorf("wait requestCipherReveal: %s", err)
	}
	if receipt.Status != 1 {
		return common.Hash{}, nil, errors.New("requestCipherReveal failed")
	}
	if len(receipt.Logs) == 0 {
		return common.Hash{}, nil, errors.New("no logs found in receipt")
	}
	instructionSent, err := s.TeeVerification.ParseTeeInstructionsSent(*receipt.Logs[0])
	if err != nil {
		return common.Hash{}, nil, errors.Errorf("parse TeeInstructionsSent: %s", err)
	}

	resp, err := fccutils.ActionResult(proxyURL, instructionSent.InstructionId)
	if err != nil {
		return common.Hash{}, nil, errors.Errorf("poll reveal result: %s", err)
	}
	if resp.Result.Status != 1 {
		return common.Hash{}, resp, errors.Errorf("TEE cipher reveal failed: %s", resp.Result.Log)
	}

	relayOpts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return common.Hash{}, resp, errors.Errorf("create transactor: %s", err)
	}
	relayTx, err := c.SubmitCipherRevealResult(
		relayOpts, resp.Result.Data, resp.Result.ID, string(resp.Result.SubmissionTag), resp.Result.Status, resp.Signature,
	)
	if err != nil {
		return common.Hash{}, resp, errors.Errorf("submitCipherRevealResult: %s", err)
	}
	relayReceipt, err := bind.WaitMined(context.Background(), s.ChainClient, relayTx)
	if err != nil {
		return common.Hash{}, resp, errors.Errorf("wait submitCipherRevealResult: %s", err)
	}
	if relayReceipt.Status != 1 {
		return common.Hash{}, resp, errors.New("submitCipherRevealResult failed")
	}
	return relayTx.Hash(), resp, nil
}
