package types

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"

	"veilbidding/pkg/decoder"
)

// RegisterDecoders registers all type decoders for this extension.
// The types-server uses these to render messages and results as human-readable JSON.
func RegisterDecoders(r *decoder.Registry) {
	// REVEAL message (ABI-encoded RevealMessage struct)
	r.Register(
		decoder.RegistryKey{OPType: "BID", OPCommand: "REVEAL", Kind: decoder.KindMessage},
		decoder.NewABIDecoder[RevealRequest](RevealMessageArg),
	)
	// REVEAL result (flat ABI tuple: uint256, address, address, uint256)
	r.Register(
		decoder.RegistryKey{OPType: "BID", OPCommand: "REVEAL", Kind: decoder.KindResult},
		revealResultDecoder{},
	)
	// SCORE message (ABI-encoded ScoreCheckMessage struct)
	r.Register(
		decoder.RegistryKey{OPType: "BID", OPCommand: "SCORE", Kind: decoder.KindMessage},
		decoder.NewABIDecoder[ScoreCheckRequest](ScoreCheckMessageArg),
	)
	// SCORE result (flat ABI tuple: uint256, address, bool)
	r.Register(
		decoder.RegistryKey{OPType: "BID", OPCommand: "SCORE", Kind: decoder.KindResult},
		scoreCheckResultDecoder{},
	)
	// MY_SCORE message (bare ABI-encoded address, not a tuple)
	r.Register(
		decoder.RegistryKey{OPType: "BID", OPCommand: "MY_SCORE", Kind: decoder.KindMessage},
		decoder.NewABIDecoder[common.Address](MyScoreMessageArg),
	)
	// MY_SCORE result (flat ABI tuple: address, uint256)
	r.Register(
		decoder.RegistryKey{OPType: "BID", OPCommand: "MY_SCORE", Kind: decoder.KindResult},
		myScoreResultDecoder{},
	)
	// STEALTH_REVEAL message (ABI-encoded StealthRevealMessage struct)
	r.Register(
		decoder.RegistryKey{OPType: "BID", OPCommand: "STEALTH_REVEAL", Kind: decoder.KindMessage},
		decoder.NewABIDecoder[StealthRevealRequest](StealthRevealMessageArg),
	)
	// STEALTH_REVEAL result (flat ABI tuple: bytes32, address, address, uint256)
	r.Register(
		decoder.RegistryKey{OPType: "BID", OPCommand: "STEALTH_REVEAL", Kind: decoder.KindResult},
		stealthRevealResultDecoder{},
	)
}

// myScoreResultDecoder decodes the flat ABI-encoded my-score result the TEE
// returns - informational only, never verified or relayed on-chain.
type myScoreResultDecoder struct{}

func (myScoreResultDecoder) Decode(data []byte) (any, error) {
	vals, err := MyScoreResultArgs.Unpack(data)
	if err != nil {
		return nil, err
	}
	if len(vals) != 2 {
		return nil, fmt.Errorf("expected 2 values, got %d", len(vals))
	}
	return MyScoreResult{
		Wallet: vals[0].(common.Address),
		Score:  vals[1].(*big.Int),
	}, nil
}

// scoreCheckResultDecoder decodes the flat ABI-encoded score-check result that
// the TEE returns (and that VeilBidding._verifyEligibility decodes on-chain).
type scoreCheckResultDecoder struct{}

func (scoreCheckResultDecoder) Decode(data []byte) (any, error) {
	vals, err := ScoreCheckResultArgs.Unpack(data)
	if err != nil {
		return nil, err
	}
	if len(vals) != 4 {
		return nil, fmt.Errorf("expected 4 values, got %d", len(vals))
	}
	return ScoreCheckResult{
		ListingId:       vals[0].(*big.Int),
		Bidder:          vals[1].(common.Address),
		TermsCommitment: vals[2].([32]byte),
		Eligible:        vals[3].(bool),
	}, nil
}

// stealthRevealResultDecoder decodes the flat ABI-encoded stealth reveal
// result that the TEE returns (and that VeilBidding.submitStealthRevealResult
// decodes on-chain).
type stealthRevealResultDecoder struct{}

func (stealthRevealResultDecoder) Decode(data []byte) (any, error) {
	vals, err := StealthRevealResultArgs.Unpack(data)
	if err != nil {
		return nil, err
	}
	if len(vals) != 4 {
		return nil, fmt.Errorf("expected 4 values, got %d", len(vals))
	}
	return StealthRevealResult{
		HashedId:      vals[0].([32]byte),
		ContractAddr:  vals[1].(common.Address),
		Winner:        vals[2].(common.Address),
		WinningAmount: vals[3].(*big.Int),
	}, nil
}

// revealResultDecoder decodes the flat ABI-encoded reveal result that the TEE
// returns (and that VeilBidding.submitRevealResult decodes on-chain).
type revealResultDecoder struct{}

func (revealResultDecoder) Decode(data []byte) (any, error) {
	vals, err := RevealResultArgs.Unpack(data)
	if err != nil {
		return nil, err
	}
	if len(vals) != 4 {
		return nil, fmt.Errorf("expected 4 values, got %d", len(vals))
	}
	return RevealResult{
		ListingId:     vals[0].(*big.Int),
		ContractAddr:  vals[1].(common.Address),
		Winner:        vals[2].(common.Address),
		WinningAmount: vals[3].(*big.Int),
	}, nil
}
