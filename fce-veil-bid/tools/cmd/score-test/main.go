// Package main is an ad-hoc validation of the SCORE eligibility gate: creates
// a listing an ordinary wallet can never clear (minScore above the 0-100
// max), confirms submitSealedBid rejects it, confirms the TEE-signed
// attestation correctly reports ineligible, then confirms a low-bar listing
// and a participant-bypassed listing both accept the same wallet.
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

	// --- Case 1: minScore above the 0-100 max — no wallet can ever clear it ---
	logger.Infof("Case 1: unreachable minScore (101) — expect rejection")
	unreachable, _, err := instrutils.CreateListing(s, contractAddr, instrutils.ListingMetadata{
		Title: "Unreachable Score Gate", Description: "test", ItemType: "file", MinBid: big.NewInt(1), MinScore: big.NewInt(101),
	}, deadline)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("create unreachable listing: %s", err))
	}
	logger.Infof("  Listing #%s created (minScore=101)", unreachable)

	attestation, err := instrutils.RequestAndGetScoreAttestation(s, contractAddr, *pf, unreachable)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("score check: %s", err))
	}
	eligible, decodeErr := decodeEligible(attestation.Data)
	if decodeErr != nil {
		fccutils.FatalWithCause(errors.Errorf("decode attestation: %s", decodeErr))
	}
	logger.Infof("  TEE says eligible=%v (expected false)", eligible)
	if eligible {
		fccutils.FatalWithCause(errors.New("FAIL: wallet should not clear an unreachable score gate"))
	}

	if _, err := instrutils.SubmitSealedBid(s, contractAddr, unreachable, common.Hash{1}, []byte{1}, attestation); err == nil {
		fccutils.FatalWithCause(errors.New("FAIL: submitSealedBid should have reverted (ineligible attestation)"))
	} else {
		logger.Infof("  ✓ submitSealedBid correctly reverted: %s", err)
	}

	// --- Case 2: minScore=1 — trivially clearable by any active wallet ---
	logger.Infof("Case 2: low minScore (1) — expect acceptance")
	low, _, err := instrutils.CreateListing(s, contractAddr, instrutils.ListingMetadata{
		Title: "Low Score Gate", Description: "test", ItemType: "file", MinBid: big.NewInt(1), MinScore: big.NewInt(1),
	}, deadline)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("create low-bar listing: %s", err))
	}
	attestation2, err := instrutils.RequestAndGetScoreAttestation(s, contractAddr, *pf, low)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("score check: %s", err))
	}
	eligible2, _ := decodeEligible(attestation2.Data)
	logger.Infof("  TEE says eligible=%v (expected true)", eligible2)
	if _, err := instrutils.SubmitSealedBid(s, contractAddr, low, common.Hash{2}, []byte{2}, attestation2); err != nil {
		fccutils.FatalWithCause(errors.Errorf("FAIL: submitSealedBid should have succeeded: %s", err))
	}
	logger.Infof("  ✓ submitSealedBid succeeded with a valid eligible attestation")

	// --- Case 3: participant bypass — unreachable minScore, but invited ---
	logger.Infof("Case 3: unreachable minScore (101) but wallet is an invited participant — expect acceptance without any attestation")
	bypass, _, err := instrutils.CreateListing(s, contractAddr, instrutils.ListingMetadata{
		Title: "Invite-Only Gate", Description: "test", ItemType: "file", MinBid: big.NewInt(1), MinScore: big.NewInt(101),
		InitialParticipants: []common.Address{wallet},
	}, deadline)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("create invite-only listing: %s", err))
	}
	if _, err := instrutils.SubmitSealedBid(s, contractAddr, bypass, common.Hash{3}, []byte{3}, instrutils.EmptyAttestation); err != nil {
		fccutils.FatalWithCause(errors.Errorf("FAIL: participant bypass should have succeeded: %s", err))
	}
	logger.Infof("  ✓ submitSealedBid succeeded via participant bypass, no attestation needed")

	fmt.Println("All SCORE gate tests passed.")
}

func decodeEligible(data []byte) (bool, error) {
	if len(data) < 96 {
		return false, errors.New("result data too short")
	}
	// abi.encode(uint256, address, bool) — bool is the third 32-byte word.
	return data[95] != 0, nil
}
