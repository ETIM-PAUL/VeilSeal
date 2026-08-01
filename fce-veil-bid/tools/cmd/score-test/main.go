// Package main is an ad-hoc validation of the score-gated / invite-only
// access modes: confirms an invite-only listing rejects a non-participant,
// confirms a score-gated listing accepts a wallet that clears the (low)
// bar, and confirms an invite-only listing accepts a wallet that's on the
// participant list without any TEE round-trip at all.
package main

import (
	"flag"
	"fmt"
	"math/big"
	"os"
	"time"

	"veilbidding/tools/pkg/configs"
	"veilbidding/tools/pkg/fccutils"
	"veilbidding/tools/pkg/support"
	instrutils "veilbidding/tools/pkg/utils"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
	"github.com/pkg/errors"
)

// someoneElse is a well-known burn address used as the sole participant on
// listings this test's own wallet should NOT be able to bid on.
var someoneElse = common.HexToAddress("0x000000000000000000000000000000000000dEaD")

func main() {
	af := flag.String("a", configs.AddressesFile, "file with deployed addresses")
	cf := flag.String("c", configs.ChainNodeURL, "chain node url")
	pf := flag.String("p", configs.ExtensionProxyURL, "extension proxy url")
	contractF := flag.String("instructionSender", os.Getenv("INSTRUCTION_SENDER"), "VeilBidding contract address")
	flag.Parse()

	if *contractF == "" {
		logger.Fatal("--instructionSender flag is required (or set INSTRUCTION_SENDER in .env)")
	}
	contractAddr := common.HexToAddress(*contractF)

	s, err := support.DefaultSupport(*af, *cf)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	wallet := crypto.PubkeyToAddress(s.Prv.PublicKey)
	deadline := uint64(time.Now().Unix() + 300)

	// --- Case 1: invite-only, wallet NOT on the list — expect rejection ---
	logger.Infof("Case 1: invite-only listing, wallet not invited — expect rejection")
	notInvited, _, err := instrutils.CreateListing(s, contractAddr, instrutils.ListingMetadata{
		Title: "Invite-Only (not me)", Description: "test", ItemType: "file", MinBid: big.NewInt(1),
		InviteOnly: true, InitialParticipants: []common.Address{someoneElse},
	}, deadline)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("create invite-only listing: %s", err))
	}
	if _, err := instrutils.SubmitSealedBid(s, contractAddr, notInvited, common.Hash{1}, []byte{1}, instrutils.EmptyAttestation); err == nil {
		fccutils.FatalWithCause(errors.New("FAIL: submitSealedBid should have reverted (not on participant list)"))
	} else {
		logger.Infof("  ✓ submitSealedBid correctly reverted: %s", err)
	}

	// --- Case 2: score-gated at the minimum threshold — expect acceptance ---
	logger.Infof("Case 2: score-gated listing at the minimum threshold (5) — expect acceptance")
	scored, _, err := instrutils.CreateListing(s, contractAddr, instrutils.ListingMetadata{
		Title: "Low Score Gate", Description: "test", ItemType: "file", MinBid: big.NewInt(1),
		MinScore: big.NewInt(instrutils.MinScoreThreshold),
	}, deadline)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("create score-gated listing: %s", err))
	}
	attestation, err := instrutils.RequestAndGetScoreAttestation(s, contractAddr, *pf, scored)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("score check: %s", err))
	}
	eligible, decodeErr := decodeEligible(attestation.Data)
	if decodeErr != nil {
		fccutils.FatalWithCause(errors.Errorf("decode attestation: %s", decodeErr))
	}
	logger.Infof("  TEE says eligible=%v (expected true)", eligible)
	if _, err := instrutils.SubmitSealedBid(s, contractAddr, scored, common.Hash{2}, []byte{2}, attestation); err != nil {
		fccutils.FatalWithCause(errors.Errorf("FAIL: submitSealedBid should have succeeded: %s", err))
	}
	logger.Infof("  ✓ submitSealedBid succeeded with a valid eligible attestation")

	// --- Case 3: invite-only, wallet IS on the list — expect acceptance, no TEE call ---
	logger.Infof("Case 3: invite-only listing, wallet invited — expect acceptance without any attestation")
	invited, _, err := instrutils.CreateListing(s, contractAddr, instrutils.ListingMetadata{
		Title: "Invite-Only (me)", Description: "test", ItemType: "file", MinBid: big.NewInt(1),
		InviteOnly: true, InitialParticipants: []common.Address{wallet},
	}, deadline)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("create invite-only listing: %s", err))
	}
	if _, err := instrutils.SubmitSealedBid(s, contractAddr, invited, common.Hash{3}, []byte{3}, instrutils.EmptyAttestation); err != nil {
		fccutils.FatalWithCause(errors.Errorf("FAIL: participant bypass should have succeeded: %s", err))
	}
	logger.Infof("  ✓ submitSealedBid succeeded via participant bypass, no attestation needed")

	// --- Case 4: MY_SCORE — informational, no listing involved ---
	logger.Infof("Case 4: requestMyScore — expect a raw score back")
	score, err := instrutils.RequestAndGetMyScore(s, contractAddr, *pf)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("requestMyScore: %s", err))
	}
	logger.Infof("  ✓ my score: %d", score)

	fmt.Println("All access-mode tests passed.")
}

func decodeEligible(data []byte) (bool, error) {
	if len(data) < 96 {
		return false, errors.New("result data too short")
	}
	// abi.encode(uint256, address, bool) — bool is the third 32-byte word.
	return data[95] != 0, nil
}
