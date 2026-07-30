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
