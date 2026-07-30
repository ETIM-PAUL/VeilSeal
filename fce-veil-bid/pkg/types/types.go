// Package types contains types that could be useful to other apps when interacting with the veilbidding extension.
package types

import (
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// RevealRequest is the ABI-decoded payload of a REVEAL instruction.
// Matches Solidity `struct RevealMessage { uint256 listingId; address contractAddr;
// address[] bidders; bytes32[] termsCommitments; bytes[] encryptedTerms; }`.
type RevealRequest struct {
	ListingId        *big.Int         `json:"listingId"`
	ContractAddr     common.Address   `json:"contractAddr"`
	Bidders          []common.Address `json:"bidders"`
	TermsCommitments [][32]byte       `json:"termsCommitments"`
	EncryptedTerms   [][]byte         `json:"encryptedTerms"`
}

// SealedTerms is the plaintext each bidder ECIES-encrypts client-side before
// calling submitSealedBid. Not ABI-encoded — a plain JSON object, since the
// contract only ever sees the ciphertext and the commitment hash, never this
// struct directly. amount/nonce/bidder mirror the on-chain commitment
// (termsCommitment = keccak256(abi.encode(amount, nonce, bidder))), letting
// the TEE recompute and verify the commitment for every decrypted bid.
type SealedTerms struct {
	Amount *big.Int       `json:"amount"`
	Nonce  common.Hash    `json:"nonce"`
	Bidder common.Address `json:"bidder"`
}

// RevealResult is the decoded form of the REVEAL result payload returned in
// ActionResult.Data and consumed by submitRevealResult on-chain.
type RevealResult struct {
	ListingId     *big.Int
	ContractAddr  common.Address
	Winner        common.Address
	WinningAmount *big.Int
}

// RevealMessageArg describes the ABI layout of RevealMessage from the Solidity contract.
var RevealMessageArg abi.Argument

// RevealResultArgs is the flat ABI tuple the TEE packs into ActionResult.Data for
// REVEAL, matching submitRevealResult's abi.decode(data, (uint256, address, address, uint256)).
var RevealResultArgs abi.Arguments

// TermsCommitmentArgs is the flat ABI tuple used for the on-chain commitment:
// keccak256(abi.encode(amount, nonce, bidder)).
var TermsCommitmentArgs abi.Arguments

func init() {
	revealTy, _ := abi.NewType("tuple", "", []abi.ArgumentMarshaling{
		{Name: "listingId", Type: "uint256"},
		{Name: "contractAddr", Type: "address"},
		{Name: "bidders", Type: "address[]"},
		{Name: "termsCommitments", Type: "bytes32[]"},
		{Name: "encryptedTerms", Type: "bytes[]"},
	})
	RevealMessageArg = abi.Argument{Type: revealTy}

	addressTy, _ := abi.NewType("address", "", nil)
	uintTy, _ := abi.NewType("uint256", "", nil)
	bytes32Ty, _ := abi.NewType("bytes32", "", nil)

	RevealResultArgs = abi.Arguments{
		{Type: uintTy},
		{Type: addressTy},
		{Type: addressTy},
		{Type: uintTy},
	}

	TermsCommitmentArgs = abi.Arguments{
		{Type: uintTy},
		{Type: bytes32Ty},
		{Type: addressTy},
	}
}

// TermsCommitment recomputes keccak256(abi.encode(amount, nonce, bidder)) so
// the extension can verify a decrypted SealedTerms matches the on-chain
// commitment the bidder published at seal time.
func TermsCommitment(t SealedTerms) (common.Hash, error) {
	encoded, err := TermsCommitmentArgs.Pack(t.Amount, [32]byte(t.Nonce), t.Bidder)
	if err != nil {
		return common.Hash{}, err
	}
	return common.BytesToHash(crypto.Keccak256(encoded)), nil
}

// State holds the extension's observable state, returned by GET /state.
type State struct {
	Ready bool `json:"ready"`
}

// --- DO NOT MODIFY below this line. ---

// StateResponse is the envelope returned by GET /state.
type StateResponse struct {
	StateVersion common.Hash `json:"stateVersion"`
	State        State       `json:"state"`
}
