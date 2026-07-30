package utils

import (
	"context"
	"encoding/json"
	"math/big"
	"os"
	"time"

	"veilbidding/pkg/types"
	"veilbidding/tools/pkg/contracts/veilbidding"
	"veilbidding/tools/pkg/fccutils"
	"veilbidding/tools/pkg/support"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	gethtypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	"github.com/pkg/errors"
)

// DefaultFee is the default fee paid with each instruction.
// Override via FEE_WEI env var.
var DefaultFee = big.NewInt(1_000_000_000_000)

func init() {
	if feeStr := os.Getenv("FEE_WEI"); feeStr != "" {
		if fee, ok := new(big.Int).SetString(feeStr, 10); ok {
			DefaultFee = fee
		}
	}
}

// DeployInstructionSender deploys VeilBidding directly — unlike a design with a linked library
// it has no linked library, so this is a plain contract deployment.
func DeployInstructionSender(s *support.Support) (common.Address, *veilbidding.VeilBidding, error) {
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return common.Address{}, nil, errors.Errorf("failed to create transactor: %s", err)
	}

	parsed, err := veilbidding.VeilBiddingMetaData.GetAbi()
	if err != nil {
		return common.Address{}, nil, errors.Errorf("parse VeilBidding ABI: %s", err)
	}

	bin := common.FromHex(veilbidding.VeilBiddingMetaData.Bin)

	// Both registry args are the FlareTeeManager diamond proxy.
	address, tx, _, err := bind.DeployContract(
		opts, *parsed, bin, s.ChainClient, s.Addresses.FlareTeeManager, s.Addresses.FlareTeeManager,
	)
	if err != nil {
		return common.Address{}, nil, errors.Errorf("failed to deploy contract: %s", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	receipt, err := bind.WaitMined(ctx, s.ChainClient, tx)
	if err != nil {
		return common.Address{}, nil, errors.Errorf("deployment tx not mined within 2 minutes (tx: %s): %s", tx.Hash().Hex(), err)
	}

	if receipt.Status != gethtypes.ReceiptStatusSuccessful {
		return common.Address{}, nil, errors.New("contract deployment failed")
	}

	vb, err := veilbidding.NewVeilBidding(address, s.ChainClient)
	if err != nil {
		return common.Address{}, nil, errors.Errorf("bind deployed VeilBidding: %s", err)
	}
	return address, vb, nil
}

// SetExtensionId calls setExtensionId on the InstructionSender contract.
func SetExtensionId(s *support.Support, instructionSenderAddress common.Address) error {
	sender, err := veilbidding.NewVeilBidding(instructionSenderAddress, s.ChainClient)
	if err != nil {
		return errors.Errorf("failed to bind contract: %s", err)
	}

	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return errors.Errorf("failed to create transactor: %s", err)
	}

	tx, err := sender.SetExtensionId(opts)
	if err != nil {
		reason := fccutils.DecodeRevertReason(err)
		if reason == "" {
			parsed, _ := veilbidding.VeilBiddingMetaData.GetAbi()
			if parsed != nil {
				callData, packErr := parsed.Pack("setExtensionId")
				if packErr == nil {
					from := crypto.PubkeyToAddress(s.Prv.PublicKey)
					reason = fccutils.SimulateAndDecodeRevert(
						s.ChainClient, from, instructionSenderAddress, nil, callData,
					)
				}
			}
		}
		if reason != "" {
			return errors.Errorf("failed to call setExtensionId: %s (revert reason: %s)", err, reason)
		}
		return errors.Errorf("failed to call setExtensionId: %s", err)
	}

	receipt, err := bind.WaitMined(context.Background(), s.ChainClient, tx)
	if err != nil {
		return errors.Errorf("failed waiting for transaction: %s", err)
	}

	if receipt.Status != gethtypes.ReceiptStatusSuccessful {
		return errors.New("setExtensionId transaction failed")
	}

	return nil
}

// SetTeeAddress registers the active TEE signing address on the contract.
func SetTeeAddress(s *support.Support, contractAddr, teeAddr common.Address) error {
	c, err := veilbidding.NewVeilBidding(contractAddr, s.ChainClient)
	if err != nil {
		return errors.Errorf("failed to bind contract: %s", err)
	}
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return errors.Errorf("failed to create transactor: %s", err)
	}
	tx, err := c.SetTeeAddress(opts, teeAddr)
	if err != nil {
		return errors.Errorf("setTeeAddress: %s", err)
	}
	receipt, err := bind.WaitMined(context.Background(), s.ChainClient, tx)
	if err != nil {
		return errors.Errorf("failed waiting for setTeeAddress: %s", err)
	}
	if receipt.Status != 1 {
		return errors.Errorf("setTeeAddress failed with status %d", receipt.Status)
	}
	return nil
}

// CreateListing opens a sealed-bid listing with the given deadline (unix seconds).
// Returns the new listing ID.
func CreateListing(s *support.Support, contractAddr common.Address, deadline uint64) (*big.Int, common.Hash, error) {
	c, err := veilbidding.NewVeilBidding(contractAddr, s.ChainClient)
	if err != nil {
		return nil, common.Hash{}, errors.Errorf("failed to bind contract: %s", err)
	}
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return nil, common.Hash{}, errors.Errorf("failed to create transactor: %s", err)
	}

	tx, err := c.CreateListing(opts, deadline)
	if err != nil {
		return nil, common.Hash{}, errors.Errorf("createListing: %s (%s)", err, simulateRevert(s, contractAddr, nil, "createListing", deadline))
	}
	receipt, err := bind.WaitMined(context.Background(), s.ChainClient, tx)
	if err != nil {
		return nil, common.Hash{}, errors.Errorf("failed waiting for createListing: %s", err)
	}
	if receipt.Status != 1 {
		return nil, common.Hash{}, errors.Errorf("createListing failed with status %d", receipt.Status)
	}

	listingCount, err := c.ListingCount(&bind.CallOpts{})
	if err != nil {
		return nil, receipt.TxHash, errors.Errorf("listingCount: %s", err)
	}
	return listingCount, receipt.TxHash, nil
}

// EncryptSealedTerms ABI-independent JSON-encodes SealedTerms and ECIES-encrypts
// them under the TEE public key from the extension proxy /info endpoint —
// matching what the frontend does client-side with eth-crypto.
func EncryptSealedTerms(proxyURL string, terms types.SealedTerms) ([]byte, error) {
	plaintext, err := json.Marshal(terms)
	if err != nil {
		return nil, errors.Errorf("encode sealed terms: %s", err)
	}

	pub, err := fccutils.TeeECIESPublicKey(proxyURL)
	if err != nil {
		return nil, err
	}
	return fccutils.EncryptForTee(pub, plaintext)
}

// SubmitSealedBid submits an on-chain commitment plus ECIES ciphertext for one bidder.
func SubmitSealedBid(s *support.Support, contractAddr common.Address, listingId *big.Int, termsCommitment common.Hash, encryptedTerms []byte) (common.Hash, error) {
	c, err := veilbidding.NewVeilBidding(contractAddr, s.ChainClient)
	if err != nil {
		return common.Hash{}, errors.Errorf("failed to bind contract: %s", err)
	}
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return common.Hash{}, errors.Errorf("failed to create transactor: %s", err)
	}

	tx, err := c.SubmitSealedBid(opts, listingId, termsCommitment, encryptedTerms)
	if err != nil {
		return common.Hash{}, errors.Errorf("submitSealedBid: %s (%s)", err, simulateRevert(s, contractAddr, nil, "submitSealedBid", listingId, termsCommitment, encryptedTerms))
	}
	receipt, err := bind.WaitMined(context.Background(), s.ChainClient, tx)
	if err != nil {
		return common.Hash{}, errors.Errorf("failed waiting for submitSealedBid: %s", err)
	}
	if receipt.Status != 1 {
		return common.Hash{}, errors.Errorf("submitSealedBid failed with status %d", receipt.Status)
	}
	return receipt.TxHash, nil
}

// SendRequestReveal routes every sealed bid for a listing to the TEE and
// returns the resulting FCC instruction ID (to poll the proxy for the result).
func SendRequestReveal(s *support.Support, contractAddr common.Address, listingId *big.Int) (common.Hash, common.Hash, error) {
	c, err := veilbidding.NewVeilBidding(contractAddr, s.ChainClient)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("failed to bind contract: %s", err)
	}
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("failed to create transactor: %s", err)
	}
	opts.Value = DefaultFee

	tx, err := c.RequestReveal(opts, listingId)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("requestReveal: %s (%s)", err, simulateRevert(s, contractAddr, DefaultFee, "requestReveal", listingId))
	}
	receipt, err := bind.WaitMined(context.Background(), s.ChainClient, tx)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("failed waiting for requestReveal: %s", err)
	}
	if receipt.Status != 1 {
		return common.Hash{}, common.Hash{}, errors.Errorf("requestReveal failed with status %d", receipt.Status)
	}
	if len(receipt.Logs) == 0 {
		return common.Hash{}, common.Hash{}, errors.New("no logs found in receipt")
	}
	instructionSent, err := s.TeeVerification.ParseTeeInstructionsSent(*receipt.Logs[0])
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("failed to parse TeeInstructionsSent event: %s", err)
	}
	return instructionSent.InstructionId, receipt.TxHash, nil
}

// SubmitRevealResult relays a TEE-signed reveal result to the contract, which
// verifies the signature and records the winner.
func SubmitRevealResult(s *support.Support, contractAddr common.Address, resultData []byte, actionID common.Hash, submissionTag string, status uint8, signature []byte) (common.Hash, error) {
	c, err := veilbidding.NewVeilBidding(contractAddr, s.ChainClient)
	if err != nil {
		return common.Hash{}, errors.Errorf("failed to bind contract: %s", err)
	}
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return common.Hash{}, errors.Errorf("failed to create transactor: %s", err)
	}

	tx, err := c.SubmitRevealResult(opts, resultData, actionID, submissionTag, status, signature)
	if err != nil {
		return common.Hash{}, errors.Errorf("submitRevealResult: %s (%s)", err, simulateRevert(s, contractAddr, nil, "submitRevealResult", resultData, actionID, submissionTag, status, signature))
	}
	receipt, err := bind.WaitMined(context.Background(), s.ChainClient, tx)
	if err != nil {
		return common.Hash{}, errors.Errorf("failed waiting for submitRevealResult: %s", err)
	}
	if receipt.Status != 1 {
		return common.Hash{}, errors.Errorf("submitRevealResult failed with status %d", receipt.Status)
	}
	return receipt.TxHash, nil
}

// RequestAndRelayReveal runs the keeper flow for one listing: sends a
// requestReveal instruction, polls the proxy for the TEE-signed result, and
// relays it to submitRevealResult(). Returns the relay tx hash and the proxy ActionResponse.
func RequestAndRelayReveal(s *support.Support, contractAddr common.Address, proxyURL string, listingId *big.Int) (common.Hash, *teetypes.ActionResponse, error) {
	logger.Infof("[reveal] start listingId=%s contract=%s proxyURL=%s", listingId.String(), contractAddr.Hex(), proxyURL)

	instructionID, requestTx, err := SendRequestReveal(s, contractAddr, listingId)
	if err != nil {
		return common.Hash{}, nil, errors.Errorf("requestReveal: %s", err)
	}
	logger.Infof("[reveal] requested instructionId=%s requestTx=%s", instructionID.Hex(), requestTx.Hex())

	resp, err := fccutils.ActionResult(proxyURL, instructionID)
	if err != nil {
		return common.Hash{}, nil, errors.Errorf("poll reveal result: %s", err)
	}
	if resp.Result.Status != 1 {
		return common.Hash{}, resp, errors.Errorf("TEE reveal failed: %s", resp.Result.Log)
	}

	relayTx, err := SubmitRevealResult(s, contractAddr, resp.Result.Data, resp.Result.ID, string(resp.Result.SubmissionTag), resp.Result.Status, resp.Signature)
	if err != nil {
		return common.Hash{}, resp, errors.Errorf("submitRevealResult: %s", err)
	}
	logger.Infof("[reveal] complete listingId=%s relayTx=%s", listingId.String(), relayTx.Hex())
	return relayTx, resp, nil
}

// simulateRevert best-effort decodes a revert reason for a failed call.
func simulateRevert(s *support.Support, contractAddr common.Address, value *big.Int, method string, args ...interface{}) string {
	parsed, err := veilbidding.VeilBiddingMetaData.GetAbi()
	if err != nil || parsed == nil {
		return ""
	}
	callData, err := parsed.Pack(method, args...)
	if err != nil {
		return ""
	}
	from := crypto.PubkeyToAddress(s.Prv.PublicKey)
	return fccutils.SimulateAndDecodeRevert(s.ChainClient, from, contractAddr, value, callData)
}
