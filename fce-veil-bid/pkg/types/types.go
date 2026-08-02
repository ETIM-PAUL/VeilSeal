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
// calling submitSealedBid. Not ABI-encoded - a plain JSON object, since the
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

// ScoreCheckRequest is the ABI-decoded payload of a SCORE instruction.
// Matches Solidity `struct ScoreCheckMessage { uint256 listingId; address bidder;
// address contractAddr; bytes32 termsCommitment; bytes encryptedTerms; }`.
// termsCommitment/encryptedTerms let the TEE check the bid amount against
// minBid in the same round-trip as the score check.
type ScoreCheckRequest struct {
	ListingId       *big.Int       `json:"listingId"`
	Bidder          common.Address `json:"bidder"`
	ContractAddr    common.Address `json:"contractAddr"`
	TermsCommitment [32]byte       `json:"termsCommitment"`
	EncryptedTerms  []byte         `json:"encryptedTerms"`
}

// ScoreCheckResult is the decoded form of the SCORE result payload - only the
// boolean ever leaves the TEE, never the wallet's actual score or bid amount.
// Bound to TermsCommitment so an attestation for one bid amount can't be
// replayed against a different one.
type ScoreCheckResult struct {
	ListingId       *big.Int
	Bidder          common.Address
	TermsCommitment [32]byte
	Eligible        bool
}

// MyScoreResult is the decoded form of the MY_SCORE result payload - unlike
// SCORE, this deliberately does reveal the actual score, but only to the
// requesting wallet itself (never posted on-chain, never relayed to a
// contract, just polled and displayed client-side).
type MyScoreResult struct {
	Wallet common.Address
	Score  *big.Int
}

// StealthRevealRequest is the ABI-decoded payload of a STEALTH_REVEAL
// instruction. Matches Solidity `struct StealthRevealMessage { bytes32 hashedId;
// address contractAddr; address[] bidders; bytes32[] termsCommitments; bytes[] encryptedTerms; }`.
// Identical shape to RevealRequest, keyed by hashedId instead of listingId.
type StealthRevealRequest struct {
	HashedId         [32]byte         `json:"hashedId"`
	ContractAddr     common.Address   `json:"contractAddr"`
	Bidders          []common.Address `json:"bidders"`
	TermsCommitments [][32]byte       `json:"termsCommitments"`
	EncryptedTerms   [][]byte         `json:"encryptedTerms"`
}

// StealthRevealResult is the decoded form of the STEALTH_REVEAL result
// payload, consumed by submitStealthRevealResult on-chain. The winner's
// address and winning amount become public exactly like a regular reveal -
// only the listing's encrypted details stay hidden, forever.
type StealthRevealResult struct {
	HashedId      [32]byte
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

// ScoreCheckMessageArg describes the ABI layout of ScoreCheckMessage from the Solidity contract.
var ScoreCheckMessageArg abi.Argument

// ScoreCheckResultArgs is the flat ABI tuple the TEE packs into ActionResult.Data
// for SCORE, matching _verifyEligibility's abi.decode(data, (uint256, address, bool)).
var ScoreCheckResultArgs abi.Arguments

// MyScoreMessageArg describes the ABI layout of a MY_SCORE instruction's
// message - just the requesting wallet's address, ABI-encoded bare (not a tuple).
var MyScoreMessageArg abi.Argument

// MyScoreResultArgs is the flat ABI tuple the TEE packs into ActionResult.Data
// for MY_SCORE: (address wallet, uint256 score).
var MyScoreResultArgs abi.Arguments

// StealthRevealMessageArg describes the ABI layout of StealthRevealMessage from the Solidity contract.
var StealthRevealMessageArg abi.Argument

// StealthRevealResultArgs is the flat ABI tuple the TEE packs into ActionResult.Data for
// STEALTH_REVEAL, matching submitStealthRevealResult's abi.decode(data, (bytes32, address, address, uint256)).
var StealthRevealResultArgs abi.Arguments

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
	boolTy, _ := abi.NewType("bool", "", nil)

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

	scoreCheckTy, _ := abi.NewType("tuple", "", []abi.ArgumentMarshaling{
		{Name: "listingId", Type: "uint256"},
		{Name: "bidder", Type: "address"},
		{Name: "contractAddr", Type: "address"},
		{Name: "termsCommitment", Type: "bytes32"},
		{Name: "encryptedTerms", Type: "bytes"},
	})
	ScoreCheckMessageArg = abi.Argument{Type: scoreCheckTy}

	ScoreCheckResultArgs = abi.Arguments{
		{Type: uintTy},
		{Type: addressTy},
		{Type: bytes32Ty},
		{Type: boolTy},
	}

	MyScoreMessageArg = abi.Argument{Type: addressTy}

	MyScoreResultArgs = abi.Arguments{
		{Type: addressTy},
		{Type: uintTy},
	}

	stealthRevealTy, _ := abi.NewType("tuple", "", []abi.ArgumentMarshaling{
		{Name: "hashedId", Type: "bytes32"},
		{Name: "contractAddr", Type: "address"},
		{Name: "bidders", Type: "address[]"},
		{Name: "termsCommitments", Type: "bytes32[]"},
		{Name: "encryptedTerms", Type: "bytes[]"},
	})
	StealthRevealMessageArg = abi.Argument{Type: stealthRevealTy}

	StealthRevealResultArgs = abi.Arguments{
		{Type: bytes32Ty},
		{Type: addressTy},
		{Type: addressTy},
		{Type: uintTy},
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
