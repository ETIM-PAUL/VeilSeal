// Package main is the reveal keeper: for a given listing it asks the TEE to
// decrypt every sealed bid and determine the winner, then relays the
// TEE-signed result to the VeilBidding contract, which verifies the
// signature and records the winner.
//
// Run after the listing's deadline has passed.
//
//	go run ./cmd/settle -contract 0x... -listingId 1
package main

import (
	"flag"
	"math/big"
	"os"

	"veilbidding/tools/pkg/configs"
	"veilbidding/tools/pkg/fccutils"
	"veilbidding/tools/pkg/support"
	instrutils "veilbidding/tools/pkg/utils"

	"github.com/ethereum/go-ethereum/common"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
	"github.com/pkg/errors"
)

func main() {
	af := flag.String("a", configs.AddressesFile, "file with deployed addresses")
	cf := flag.String("c", configs.ChainNodeURL, "chain node url")
	pf := flag.String("p", configs.ExtensionProxyURL, "extension proxy url")
	contractF := flag.String("contract", os.Getenv("INSTRUCTION_SENDER"), "VeilBidding contract address")
	listingF := flag.Int64("listingId", -1, "listing id to reveal")
	flag.Parse()

	if *contractF == "" {
		logger.Fatal("--contract is required (or set INSTRUCTION_SENDER in .env)")
	}
	if *listingF < 0 {
		logger.Fatal("--listingId is required")
	}

	contractAddr := common.HexToAddress(*contractF)
	listingId := big.NewInt(*listingF)

	s, err := support.DefaultSupport(*af, *cf)
	if err != nil {
		fccutils.FatalWithCause(err)
	}

	logger.Infof("Revealing listing %s on %s ...", listingId, contractAddr.Hex())
	relayTx, resp, err := instrutils.RequestAndRelayReveal(s, contractAddr, *pf, listingId)
	if err != nil {
		fccutils.FatalWithCause(errors.Errorf("reveal failed: %s", err))
	}

	logger.Infof("  TEE result data: %s", resp.Result.Data.String())
	logger.Infof("  Relay tx: %s", relayTx.Hex())
	logger.Infof("Done.")
}
