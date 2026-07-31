// Package main runs the sealed-bid end-to-end demo:
//  1. setExtensionId on the deployed VeilBidding contract (idempotent)
//  2. register the TEE signing address (read from the proxy)
//  3. create a listing with a short deadline
//  4. submit a sealed bid (on-chain commitment + ECIES ciphertext)
//  5. wait for the deadline, then keeper: request reveal → poll the TEE → relay the signed result
//  6. assert the listing revealed with the expected winner and amount
package main

import (
	"crypto/rand"
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
	"github.com/pkg/errors"
)

func main() {
	af := flag.String("a", configs.AddressesFile, "file with deployed addresses")
	cf := flag.String("c", configs.ChainNodeURL, "chain node url")
	pf := flag.String("p", configs.ExtensionProxyURL, "extension proxy url")
	contractF := flag.String("instructionSender", os.Getenv("INSTRUCTION_SENDER"), "VeilBidding contract address")
	amountF := flag.Int64("amount", 18000, "sealed bid amount (integer base units, e.g. cents)")
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
	bidder := crypto.PubkeyToAddress(s.Prv.PublicKey)

	// --- Step 1: setExtensionId ---
	logger.Infof("Step 1: Setting extension ID...")
	if err := instrutils.SetExtensionId(s, contractAddr); err != nil {
		if strings.Contains(err.Error(), "Extension ID already set") {
			logger.Infof("  Extension ID already set (pre-build already registered it).")
		} else {
			fccutils.FatalWithCause(errors.Errorf("setExtensionId failed — is the extension registered (pre-build)? %s", err))
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

	// --- Step 3: create a listing ---
	deadline := uint64(time.Now().Unix() + *deadlineSecsF)
	logger.Infof("Step 3: Creating listing (deadline in %ds)...", *deadlineSecsF)
	meta := instrutils.ListingMetadata{
		Title:       "E2E Test Listing",
		Description: "Created by tools/cmd/run-test",
		ItemType:    "file",
		IpfsHash:    "",
		MinBid:      big.NewInt(*amountF),
	}
	listingId, createTx, err := instrutils.CreateListing(s, contractAddr, meta, deadline)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("createListing: %s", err))
	}
	logger.Infof("  Listing #%s created (tx %s)", listingId, createTx.Hex())

	// --- Step 4: submit a sealed bid ---
	logger.Infof("Step 4: Sealing a bid of %d for listing #%s...", *amountF, listingId)

	var nonceBytes [32]byte
	if _, err := rand.Read(nonceBytes[:]); err != nil {
		fccutils.FatalWithCause(errors.Errorf("generate nonce: %s", err))
	}
	nonce := common.Hash(nonceBytes)

	terms := types.SealedTerms{
		Amount: big.NewInt(*amountF),
		Nonce:  nonce,
		Bidder: bidder,
	}
	commitment, err := types.TermsCommitment(terms)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("compute commitment: %s", err))
	}

	ciphertext, err := instrutils.EncryptSealedTerms(*pf, terms)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("encrypt sealed terms: %s", err))
	}

	sealTx, err := instrutils.SubmitSealedBid(s, contractAddr, listingId, commitment, ciphertext, instrutils.EmptyAttestation)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("submitSealedBid: %s", err))
	}
	logger.Infof("  Sealed bid submitted (tx %s)", sealTx.Hex())

	// --- Step 5: wait for the deadline, then keeper reveals ---
	wait := time.Until(time.Unix(int64(deadline), 0)) + 2*time.Second
	if wait > 0 {
		logger.Infof("Step 5: Waiting %s for the deadline to pass...", wait)
		time.Sleep(wait)
	}

	logger.Infof("  Revealing listing #%s (keeper)...", listingId)
	relayTx, resp, err := instrutils.RequestAndRelayReveal(s, contractAddr, *pf, listingId)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("reveal: %s", err))
	}
	logger.Infof("  TEE result data: %s", resp.Result.Data.String())
	logger.Infof("  Relay tx: %s", relayTx.Hex())

	// --- Step 6: verify outcome ---
	logger.Infof("Step 6: Reading revealed listing...")
	c, err := veilbidding.NewVeilBidding(contractAddr, s.ChainClient)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("bind contract: %s", err))
	}
	l, err := c.Listings(&bind.CallOpts{}, listingId)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("read listing: %s", err))
	}

	logger.Infof("  revealed=%v winner=%s winningAmount=%s", l.Revealed, l.Winner.Hex(), l.WinningAmount)

	if !l.Revealed {
		fccutils.FatalWithCause(errors.New("FAIL: listing not revealed"))
	}
	if l.Winner != bidder {
		fccutils.FatalWithCause(errors.Errorf("FAIL: winner %s != expected bidder %s", l.Winner.Hex(), bidder.Hex()))
	}
	if l.WinningAmount.Cmp(big.NewInt(*amountF)) != 0 {
		fccutils.FatalWithCause(errors.Errorf("FAIL: winningAmount %s != expected %d", l.WinningAmount, *amountF))
	}

	logger.Infof("  ✓ Listing #%s revealed — winner %s at %s, matching the sealed bid.", listingId, l.Winner.Hex(), l.WinningAmount)
	logger.Infof("All tests passed.")
}
