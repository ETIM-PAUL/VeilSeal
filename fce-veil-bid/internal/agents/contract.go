package agents

import (
	"context"
	"crypto/ecdsa"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

var errReverted = errors.New("submitSealedBid transaction reverted")

// Minimal ABI subset the watcher needs beyond what internal/extension/chain.go
// already reads - same "don't pull in the tools module's generated bindings"
// constraint applies here (see chain.go's comment). Field order in "listings"
// must match the Listing struct in contracts/InstructionSender.sol exactly.
const watcherABIJSON = `[
	{"type":"function","name":"listingCount","stateMutability":"view","inputs":[],
	 "outputs":[{"name":"","type":"uint256"}]},
	{"type":"function","name":"listings","stateMutability":"view",
	 "inputs":[{"name":"","type":"uint256"}],
	 "outputs":[
		{"name":"creator","type":"address"},
		{"name":"deadline","type":"uint64"},
		{"name":"revealed","type":"bool"},
		{"name":"winner","type":"address"},
		{"name":"winningAmount","type":"uint256"},
		{"name":"title","type":"string"},
		{"name":"description","type":"string"},
		{"name":"itemType","type":"string"},
		{"name":"ipfsHash","type":"string"},
		{"name":"minBid","type":"uint256"},
		{"name":"minScore","type":"uint256"},
		{"name":"inviteOnly","type":"bool"}
	 ]},
	{"type":"function","name":"isParticipant","stateMutability":"view",
	 "inputs":[{"name":"","type":"uint256"},{"name":"","type":"address"}],
	 "outputs":[{"name":"","type":"bool"}]},
	{"type":"function","name":"sealedBids","stateMutability":"view",
	 "inputs":[{"name":"","type":"uint256"},{"name":"","type":"address"}],
	 "outputs":[
		{"name":"termsCommitment","type":"bytes32"},
		{"name":"encryptedTerms","type":"bytes"},
		{"name":"submitted","type":"bool"}
	 ]},
	{"type":"function","name":"submitSealedBid","stateMutability":"nonpayable",
	 "inputs":[
		{"name":"_listingId","type":"uint256"},
		{"name":"_termsCommitment","type":"bytes32"},
		{"name":"_encryptedTerms","type":"bytes"},
		{"name":"_attestation","type":"tuple","components":[
			{"name":"data","type":"bytes"},
			{"name":"actionId","type":"bytes32"},
			{"name":"submissionTag","type":"string"},
			{"name":"status","type":"uint8"},
			{"name":"signature","type":"bytes"}
		]}
	 ],"outputs":[]},
	{"type":"function","name":"requestScoreCheck","stateMutability":"payable",
	 "inputs":[
		{"name":"_listingId","type":"uint256"},
		{"name":"_termsCommitment","type":"bytes32"},
		{"name":"_encryptedTerms","type":"bytes"}
	 ],"outputs":[{"name":"instructionId","type":"bytes32"}]},
	{"type":"event","name":"ScoreCheckRequested","anonymous":false,
	 "inputs":[
		{"name":"listingId","type":"uint256","indexed":true},
		{"name":"bidder","type":"address","indexed":true},
		{"name":"instructionId","type":"bytes32","indexed":false}
	 ]}
]`

// instructionFeeWei is the wei value forwarded to sendInstructions for every
// FCC instruction - mirrors tools/pkg/utils.DefaultFee and the frontend's
// INSTRUCTION_FEE_WEI (src/contracts/VeilBidding.js).
var instructionFeeWei = big.NewInt(1_000_000_000_000)

var watcherABI abi.ABI

func init() {
	parsed, err := abi.JSON(strings.NewReader(watcherABIJSON))
	if err != nil {
		panic("parse watcher ABI: " + err.Error())
	}
	watcherABI = parsed
}

// Listing mirrors contracts/InstructionSender.sol's Listing struct.
type Listing struct {
	Creator       common.Address
	Deadline      uint64
	Revealed      bool
	Winner        common.Address
	WinningAmount *big.Int
	Title         string
	Description   string
	ItemType      string
	IpfsHash      string
	MinBid        *big.Int
	MinScore      *big.Int
	InviteOnly    bool
}

// attestationT mirrors the Solidity EligibilityAttestation tuple. Invite-only
// listings never check it, so callers pass the zero value there, same as a
// human bidder would for a non-score-gated listing; score-gated listings
// pass the real TEE-signed result from requestEligibilityAttestation.
type attestationT struct {
	Data          []byte
	ActionId      [32]byte
	SubmissionTag string
	Status        uint8
	Signature     []byte
}

func callContract(ctx context.Context, client *ethclient.Client, addr common.Address, method string, args ...interface{}) ([]interface{}, error) {
	data, err := watcherABI.Pack(method, args...)
	if err != nil {
		return nil, err
	}
	out, err := client.CallContract(ctx, ethereum.CallMsg{To: &addr, Data: data}, nil)
	if err != nil {
		return nil, err
	}
	return watcherABI.Unpack(method, out)
}

func listingCount(ctx context.Context, client *ethclient.Client, addr common.Address) (*big.Int, error) {
	vals, err := callContract(ctx, client, addr, "listingCount")
	if err != nil {
		return nil, err
	}
	return vals[0].(*big.Int), nil
}

func getListing(ctx context.Context, client *ethclient.Client, addr common.Address, listingId *big.Int) (*Listing, error) {
	vals, err := callContract(ctx, client, addr, "listings", listingId)
	if err != nil {
		return nil, err
	}
	return &Listing{
		Creator:       vals[0].(common.Address),
		Deadline:      vals[1].(uint64),
		Revealed:      vals[2].(bool),
		Winner:        vals[3].(common.Address),
		WinningAmount: vals[4].(*big.Int),
		Title:         vals[5].(string),
		Description:   vals[6].(string),
		ItemType:      vals[7].(string),
		IpfsHash:      vals[8].(string),
		MinBid:        vals[9].(*big.Int),
		MinScore:      vals[10].(*big.Int),
		InviteOnly:    vals[11].(bool),
	}, nil
}

func isParticipant(ctx context.Context, client *ethclient.Client, addr common.Address, listingId *big.Int, wallet common.Address) (bool, error) {
	vals, err := callContract(ctx, client, addr, "isParticipant", listingId, wallet)
	if err != nil {
		return false, err
	}
	return vals[0].(bool), nil
}

func alreadyBid(ctx context.Context, client *ethclient.Client, addr common.Address, listingId *big.Int, wallet common.Address) (bool, error) {
	vals, err := callContract(ctx, client, addr, "sealedBids", listingId, wallet)
	if err != nil {
		return false, err
	}
	return vals[2].(bool), nil
}

// submitSealedBidAs signs and sends submitSealedBid using key directly - the
// agent bids AS the wallet that key belongs to, so on-chain eligibility
// (isParticipant) and every downstream check see that wallet as the bidder,
// exactly as if it had submitted the bid manually via a browser wallet.
func submitSealedBidAs(
	ctx context.Context,
	client *ethclient.Client,
	contractAddr common.Address,
	chainID *big.Int,
	key *ecdsa.PrivateKey,
	listingId *big.Int,
	termsCommitment [32]byte,
	encryptedTerms []byte,
	attestation attestationT,
) (common.Hash, error) {
	auth, err := bind.NewKeyedTransactorWithChainID(key, chainID)
	if err != nil {
		return common.Hash{}, err
	}
	auth.Context = ctx

	bound := bind.NewBoundContract(contractAddr, watcherABI, client, client, client)
	tx, err := bound.Transact(auth, "submitSealedBid", listingId, termsCommitment, encryptedTerms, attestation)
	if err != nil {
		return common.Hash{}, err
	}

	receipt, err := bind.WaitMined(ctx, client, tx)
	if err != nil {
		return tx.Hash(), err
	}
	if receipt.Status != types.ReceiptStatusSuccessful {
		return tx.Hash(), errReverted
	}
	return tx.Hash(), nil
}

// requestScoreCheckTx signs and sends requestScoreCheck using key directly -
// the request must come from the bidder's own wallet, since the resulting
// EligibilityAttestation is bound to msg.sender. Returns the instructionId
// from the ScoreCheckRequested event so the caller can poll ext-proxy for
// the TEE's signed verdict.
func requestScoreCheckTx(
	ctx context.Context,
	client *ethclient.Client,
	contractAddr common.Address,
	chainID *big.Int,
	key *ecdsa.PrivateKey,
	listingId *big.Int,
	termsCommitment [32]byte,
	encryptedTerms []byte,
) (common.Hash, error) {
	auth, err := bind.NewKeyedTransactorWithChainID(key, chainID)
	if err != nil {
		return common.Hash{}, err
	}
	auth.Context = ctx
	auth.Value = instructionFeeWei

	bound := bind.NewBoundContract(contractAddr, watcherABI, client, client, client)
	tx, err := bound.Transact(auth, "requestScoreCheck", listingId, termsCommitment, encryptedTerms)
	if err != nil {
		return common.Hash{}, err
	}

	receipt, err := bind.WaitMined(ctx, client, tx)
	if err != nil {
		return common.Hash{}, err
	}
	if receipt.Status != types.ReceiptStatusSuccessful {
		return common.Hash{}, errReverted
	}

	topic := watcherABI.Events["ScoreCheckRequested"].ID
	for _, log := range receipt.Logs {
		if log.Address == contractAddr && len(log.Topics) > 0 && log.Topics[0] == topic && len(log.Data) >= 32 {
			return common.BytesToHash(log.Data[len(log.Data)-32:]), nil
		}
	}
	return common.Hash{}, fmt.Errorf("ScoreCheckRequested event not found in receipt")
}
