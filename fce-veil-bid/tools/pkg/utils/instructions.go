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

// MinScoreThreshold mirrors VeilBidding.sol's MIN_SCORE_THRESHOLD - the
// lowest minScore createListing accepts for a score-gated (non-invite-only) listing.
const MinScoreThreshold = 5

func init() {
	if feeStr := os.Getenv("FEE_WEI"); feeStr != "" {
		if fee, ok := new(big.Int).SetString(feeStr, 10); ok {
			DefaultFee = fee
		}
	}
}

// DeployInstructionSender deploys VeilBidding directly - unlike a design with a linked library
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

// ListingMetadata is the off-chain-authored, on-chain-stored description of
// a sealed-bid item. Every listing is gated one way or the other - there's
// no "open to everyone" mode: either InviteOnly (only InitialParticipants may
// ever bid, MinScore is ignored) or score-gated (MinScore must be 5-100,
// TEE-verified per bidder; InitialParticipants still bypass it).
type ListingMetadata struct {
	Title               string
	Description         string
	ItemType            string
	IpfsHash            string
	MinBid              *big.Int
	MinScore            *big.Int
	InviteOnly          bool
	InitialParticipants []common.Address
}

// CreateListing opens a sealed-bid listing with the given item metadata and
// deadline (unix seconds). Returns the new listing ID.
func CreateListing(s *support.Support, contractAddr common.Address, meta ListingMetadata, deadline uint64) (*big.Int, common.Hash, error) {
	c, err := veilbidding.NewVeilBidding(contractAddr, s.ChainClient)
	if err != nil {
		return nil, common.Hash{}, errors.Errorf("failed to bind contract: %s", err)
	}
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return nil, common.Hash{}, errors.Errorf("failed to create transactor: %s", err)
	}

	minScore := meta.MinScore
	if minScore == nil {
		minScore = big.NewInt(MinScoreThreshold)
	}

	tx, err := c.CreateListing(
		opts, meta.Title, meta.Description, meta.ItemType, meta.IpfsHash, meta.MinBid, minScore, meta.InviteOnly, deadline, meta.InitialParticipants,
	)
	if err != nil {
		return nil, common.Hash{}, errors.Errorf(
			"createListing: %s (%s)", err,
			simulateRevert(s, contractAddr, nil, "createListing", meta.Title, meta.Description, meta.ItemType, meta.IpfsHash, meta.MinBid, minScore, meta.InviteOnly, deadline, meta.InitialParticipants),
		)
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
// them under the TEE public key from the extension proxy /info endpoint -
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

// EmptyAttestation is passed when a listing has no minScore gate (or the
// caller is an invited participant) - submitSealedBid never inspects it in
// that case.
var EmptyAttestation = veilbidding.VeilBiddingEligibilityAttestation{}

// SubmitSealedBid submits an on-chain commitment plus ECIES ciphertext for one
// bidder. attestation should be EmptyAttestation unless the listing has a
// minScore gate the caller isn't exempt from - see RequestAndGetScoreAttestation.
func SubmitSealedBid(s *support.Support, contractAddr common.Address, listingId *big.Int, termsCommitment common.Hash, encryptedTerms []byte, attestation veilbidding.VeilBiddingEligibilityAttestation) (common.Hash, error) {
	c, err := veilbidding.NewVeilBidding(contractAddr, s.ChainClient)
	if err != nil {
		return common.Hash{}, errors.Errorf("failed to bind contract: %s", err)
	}
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return common.Hash{}, errors.Errorf("failed to create transactor: %s", err)
	}

	tx, err := c.SubmitSealedBid(opts, listingId, termsCommitment, encryptedTerms, attestation)
	if err != nil {
		return common.Hash{}, errors.Errorf("submitSealedBid: %s (%s)", err, simulateRevert(s, contractAddr, nil, "submitSealedBid", listingId, termsCommitment, encryptedTerms, attestation))
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

// SendRequestScoreCheck requests a private TEE eligibility check for the
// caller against one listing's minScore AND the sealed bid's amount against
// minBid, returning the FCC instruction ID to poll the proxy for the result.
// termsCommitment/encryptedTerms should be the same values about to be passed
// to SubmitSealedBid - the TEE decrypts encryptedTerms itself to check the
// amount, and binds the attestation to termsCommitment so it can't be
// replayed against a different bid.
func SendRequestScoreCheck(s *support.Support, contractAddr common.Address, listingId *big.Int, termsCommitment common.Hash, encryptedTerms []byte) (common.Hash, common.Hash, error) {
	c, err := veilbidding.NewVeilBidding(contractAddr, s.ChainClient)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("failed to bind contract: %s", err)
	}
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("failed to create transactor: %s", err)
	}
	opts.Value = DefaultFee

	tx, err := c.RequestScoreCheck(opts, listingId, termsCommitment, encryptedTerms)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("requestScoreCheck: %s (%s)", err, simulateRevert(s, contractAddr, DefaultFee, "requestScoreCheck", listingId, termsCommitment, encryptedTerms))
	}
	receipt, err := bind.WaitMined(context.Background(), s.ChainClient, tx)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("failed waiting for requestScoreCheck: %s", err)
	}
	if receipt.Status != 1 {
		return common.Hash{}, common.Hash{}, errors.Errorf("requestScoreCheck failed with status %d", receipt.Status)
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

// RequestAndGetScoreAttestation runs the eligibility-check round trip: sends
// requestScoreCheck (checking both score and the sealed bid's amount against
// minBid), polls the proxy for the TEE-signed result, and returns it as an
// EligibilityAttestation ready to pass into SubmitSealedBid with the same
// termsCommitment/encryptedTerms - no separate relay transaction,
// submitSealedBid verifies it inline.
func RequestAndGetScoreAttestation(s *support.Support, contractAddr common.Address, proxyURL string, listingId *big.Int, termsCommitment common.Hash, encryptedTerms []byte) (veilbidding.VeilBiddingEligibilityAttestation, error) {
	instructionID, _, err := SendRequestScoreCheck(s, contractAddr, listingId, termsCommitment, encryptedTerms)
	if err != nil {
		return EmptyAttestation, errors.Errorf("requestScoreCheck: %s", err)
	}

	resp, err := fccutils.ActionResult(proxyURL, instructionID)
	if err != nil {
		return EmptyAttestation, errors.Errorf("poll score result: %s", err)
	}
	if resp.Result.Status != 1 {
		return EmptyAttestation, errors.Errorf("TEE score check failed: %s", resp.Result.Log)
	}

	return veilbidding.VeilBiddingEligibilityAttestation{
		Data:          resp.Result.Data,
		ActionId:      resp.Result.ID,
		SubmissionTag: string(resp.Result.SubmissionTag),
		Status:        resp.Result.Status,
		Signature:     resp.Signature,
	}, nil
}

// SendRequestMyScore requests a private, informational read of the caller's
// own signal score - no listing/threshold involved, nothing ever posted
// back on-chain. Returns the FCC instruction ID to poll the proxy for the result.
func SendRequestMyScore(s *support.Support, contractAddr common.Address) (common.Hash, common.Hash, error) {
	c, err := veilbidding.NewVeilBidding(contractAddr, s.ChainClient)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("failed to bind contract: %s", err)
	}
	opts, err := bind.NewKeyedTransactorWithChainID(s.Prv, s.ChainID)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("failed to create transactor: %s", err)
	}
	opts.Value = DefaultFee

	tx, err := c.RequestMyScore(opts)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("requestMyScore: %s (%s)", err, simulateRevert(s, contractAddr, DefaultFee, "requestMyScore"))
	}
	receipt, err := bind.WaitMined(context.Background(), s.ChainClient, tx)
	if err != nil {
		return common.Hash{}, common.Hash{}, errors.Errorf("failed waiting for requestMyScore: %s", err)
	}
	if receipt.Status != 1 {
		return common.Hash{}, common.Hash{}, errors.Errorf("requestMyScore failed with status %d", receipt.Status)
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

// RequestAndGetMyScore runs the my-score round trip: sends requestMyScore,
// polls the proxy for the TEE's result, and returns the decoded score.
func RequestAndGetMyScore(s *support.Support, contractAddr common.Address, proxyURL string) (int64, error) {
	instructionID, _, err := SendRequestMyScore(s, contractAddr)
	if err != nil {
		return 0, errors.Errorf("requestMyScore: %s", err)
	}

	resp, err := fccutils.ActionResult(proxyURL, instructionID)
	if err != nil {
		return 0, errors.Errorf("poll my-score result: %s", err)
	}
	if resp.Result.Status != 1 {
		return 0, errors.Errorf("TEE my-score check failed: %s", resp.Result.Log)
	}

	vals, err := types.MyScoreResultArgs.Unpack(resp.Result.Data)
	if err != nil {
		return 0, errors.Errorf("decode my-score result: %s", err)
	}
	score := vals[1].(*big.Int)
	return score.Int64(), nil
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
