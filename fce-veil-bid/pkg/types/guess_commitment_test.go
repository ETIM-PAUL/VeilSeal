package types

import (
	"testing"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/flare-foundation/go-flare-common/pkg/tee/structs"
)

func TestGuessCommitment_matchesFlatABIEncode(t *testing.T) {
	guesser := common.HexToAddress("0x00000000000000000000000000000000000000b0b")
	nonce := common.HexToHash("0x1234")
	arrangement := []uint8{3, 1, 4, 0, 2, 5, 7, 6, 8, 10, 9, 11}

	guess := SealedGuess{Arrangement: arrangement, Nonce: nonce, Guesser: guesser}

	got, err := GuessCommitment(guess)
	if err != nil {
		t.Fatalf("GuessCommitment: %v", err)
	}

	flat, err := GuessCommitmentArgs.Pack(arrangement, [32]byte(nonce), guesser)
	if err != nil {
		t.Fatalf("Pack: %v", err)
	}
	want := common.BytesToHash(crypto.Keccak256(flat))
	if got != want {
		t.Fatalf("commitment mismatch:\n got  %s\n want %s", got.Hex(), want.Hex())
	}

	// Regression guard: tuple encoding (structs.Encode) used to differ from flat abi.encode
	// for TermsCommitment - guard the same way here so GuessCommitment doesn't regress the
	// same way if this ever gets refactored to use structs.Encode.
	tupleTy, err := abi.NewType("tuple", "", []abi.ArgumentMarshaling{
		{Name: "arrangement", Type: "uint8[]"},
		{Name: "nonce", Type: "bytes32"},
		{Name: "guesser", Type: "address"},
	})
	if err != nil {
		t.Fatalf("abi.NewType: %v", err)
	}
	tupleEncoded, err := structs.Encode(abi.Argument{Type: tupleTy}, guess)
	if err != nil {
		t.Fatalf("structs.Encode: %v", err)
	}
	if common.BytesToHash(crypto.Keccak256(tupleEncoded)) == got {
		t.Fatal("commitment must not use tuple encoding")
	}
}
