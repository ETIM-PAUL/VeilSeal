package extension

import (
	"context"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

// minimalVeilBiddingABI covers only the view functions the SCORE and stealth
// listing handlers need. The full contract ABI lives in
// tools/pkg/contracts/veilbidding, but that package belongs to the tools
// submodule (which depends on this one, not the other way around) - pulling
// it in here would require restructuring the module graph for a handful of
// trivial getters.
const minimalVeilBiddingABI = `[
	{"type":"function","name":"listingMinScore","stateMutability":"view",
	 "inputs":[{"name":"_listingId","type":"uint256"}],
	 "outputs":[{"name":"","type":"uint256"}]},
	{"type":"function","name":"listingMinBid","stateMutability":"view",
	 "inputs":[{"name":"_listingId","type":"uint256"}],
	 "outputs":[{"name":"","type":"uint256"}]},
	{"type":"function","name":"totalBidsPlaced","stateMutability":"view",
	 "inputs":[{"name":"","type":"address"}],
	 "outputs":[{"name":"","type":"uint256"}]},
	{"type":"function","name":"isStealthParticipant","stateMutability":"view",
	 "inputs":[{"name":"","type":"bytes32"},{"name":"","type":"address"}],
	 "outputs":[{"name":"","type":"bool"}]},
	{"type":"function","name":"stealthListings","stateMutability":"view",
	 "inputs":[{"name":"","type":"bytes32"}],
	 "outputs":[
	   {"name":"creator","type":"address"},
	   {"name":"deadline","type":"uint64"},
	   {"name":"revealed","type":"bool"},
	   {"name":"winner","type":"address"},
	   {"name":"winningAmount","type":"uint256"},
	   {"name":"encryptedDetails","type":"bytes"}
	 ]}
]`

var veilBiddingABI abi.ABI

func init() {
	parsed, err := abi.JSON(strings.NewReader(minimalVeilBiddingABI))
	if err != nil {
		panic("parse minimal VeilBidding ABI: " + err.Error())
	}
	veilBiddingABI = parsed
}

// callUint256 makes an eth_call against the InstructionSender contract for a
// view function returning a single uint256.
func callUint256(ctx context.Context, client *ethclient.Client, contractAddr common.Address, method string, args ...interface{}) (*big.Int, error) {
	data, err := veilBiddingABI.Pack(method, args...)
	if err != nil {
		return nil, err
	}
	out, err := client.CallContract(ctx, ethereum.CallMsg{To: &contractAddr, Data: data}, nil)
	if err != nil {
		return nil, err
	}
	vals, err := veilBiddingABI.Unpack(method, out)
	if err != nil {
		return nil, err
	}
	return vals[0].(*big.Int), nil
}

// listingMinScore reads Listing.minScore directly from chain - the TEE never
// trusts a caller-supplied threshold, only what's actually on-chain right now.
func listingMinScore(ctx context.Context, client *ethclient.Client, contractAddr common.Address, listingId *big.Int) (*big.Int, error) {
	return callUint256(ctx, client, contractAddr, "listingMinScore", listingId)
}

// listingMinBid reads Listing.minBid directly from chain, for the same reason
// listingMinScore does - the TEE checks a bid's decrypted amount against this,
// never a caller-supplied threshold.
func listingMinBid(ctx context.Context, client *ethclient.Client, contractAddr common.Address, listingId *big.Int) (*big.Int, error) {
	return callUint256(ctx, client, contractAddr, "listingMinBid", listingId)
}

// totalBidsPlaced reads a wallet's lifetime sealed-bid count on this contract.
func totalBidsPlaced(ctx context.Context, client *ethclient.Client, contractAddr common.Address, wallet common.Address) (*big.Int, error) {
	return callUint256(ctx, client, contractAddr, "totalBidsPlaced", wallet)
}

// stealthListingInfo mirrors the StealthListing struct's on-chain shape -
// deadline == 0 means "no such listing" (same zero-value-means-unset
// convention as the Solidity struct).
type stealthListingInfo struct {
	Creator          common.Address
	Deadline         uint64
	Revealed         bool
	Winner           common.Address
	WinningAmount    *big.Int
	EncryptedDetails []byte
}

// readStealthListing reads a stealth listing's on-chain state, including its
// still-encrypted details blob - decryption only ever happens after the
// caller has already been verified as a participant (see stealthDetailsHandler).
func readStealthListing(ctx context.Context, client *ethclient.Client, contractAddr common.Address, hashedId [32]byte) (*stealthListingInfo, error) {
	data, err := veilBiddingABI.Pack("stealthListings", hashedId)
	if err != nil {
		return nil, err
	}
	out, err := client.CallContract(ctx, ethereum.CallMsg{To: &contractAddr, Data: data}, nil)
	if err != nil {
		return nil, err
	}
	vals, err := veilBiddingABI.Unpack("stealthListings", out)
	if err != nil {
		return nil, err
	}
	return &stealthListingInfo{
		Creator:          vals[0].(common.Address),
		Deadline:         vals[1].(uint64),
		Revealed:         vals[2].(bool),
		Winner:           vals[3].(common.Address),
		WinningAmount:    vals[4].(*big.Int),
		EncryptedDetails: vals[5].([]byte),
	}, nil
}

// isStealthParticipant reads whether a wallet is on a stealth listing's
// creator-invited allowlist - the sole admission control for both bidding and
// viewing its decrypted details.
func isStealthParticipant(ctx context.Context, client *ethclient.Client, contractAddr common.Address, hashedId [32]byte, wallet common.Address) (bool, error) {
	data, err := veilBiddingABI.Pack("isStealthParticipant", hashedId, wallet)
	if err != nil {
		return false, err
	}
	out, err := client.CallContract(ctx, ethereum.CallMsg{To: &contractAddr, Data: data}, nil)
	if err != nil {
		return false, err
	}
	vals, err := veilBiddingABI.Unpack("isStealthParticipant", out)
	if err != nil {
		return false, err
	}
	return vals[0].(bool), nil
}

// Scoring weights and tiers. A hackathon-scoped, transparent, on-chain-only
// signal set: no off-chain/user-submitted data is required, so there's
// nothing to trust beyond what's already public on Coston2. None of these
// raw signals (balance, tx count, prior bids) or the derived score ever
// leave the TEE - only the final eligible/not-eligible boolean does.
const (
	maxScore = 100
)

var balanceTiersWei = []struct {
	minWei *big.Int
	points int
}{
	{weiFromFlr(100), 40},
	{weiFromFlr(50), 30},
	{weiFromFlr(10), 20},
	{weiFromFlr(1), 10},
}

var activityTiers = []struct {
	minTxCount uint64
	points     int
}{
	{50, 30},
	{20, 20},
	{5, 10},
}

var reputationTiers = []struct {
	minBids int64
	points  int
}{
	{10, 30},
	{5, 20},
	{1, 10},
}

func weiFromFlr(flr int64) *big.Int {
	return new(big.Int).Mul(big.NewInt(flr), big.NewInt(1_000_000_000_000_000_000))
}

// computeScore derives a 0-100 wallet signal score from three on-chain
// signals: current balance (skin in the game), tx count (sybil/spam
// resistance), and prior sealed bids on this contract (platform-specific
// reputation - the strongest signal, since it reflects actual behavior here).
func computeScore(ctx context.Context, client *ethclient.Client, instructionSender common.Address, wallet common.Address) (int, error) {
	balance, err := client.BalanceAt(ctx, wallet, nil)
	if err != nil {
		return 0, err
	}
	txCount, err := client.NonceAt(ctx, wallet, nil)
	if err != nil {
		return 0, err
	}
	bids, err := totalBidsPlaced(ctx, client, instructionSender, wallet)
	if err != nil {
		return 0, err
	}

	score := 0
	for _, tier := range balanceTiersWei {
		if balance.Cmp(tier.minWei) >= 0 {
			score += tier.points
			break
		}
	}
	for _, tier := range activityTiers {
		if txCount >= tier.minTxCount {
			score += tier.points
			break
		}
	}
	for _, tier := range reputationTiers {
		if bids.Cmp(big.NewInt(tier.minBids)) >= 0 {
			score += tier.points
			break
		}
	}

	if score > maxScore {
		score = maxScore
	}
	return score, nil
}
