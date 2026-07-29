import { Contract, BrowserProvider, JsonRpcProvider } from "ethers";

import { COSTON2_PARAMS } from "../utils/network";

// ABI generated from artifacts/contracts/VeilBidding.sol/VeilBidding.json —
// keep in sync if the contract changes and is recompiled.
export const VEIL_BIDDING_ABI = [{"inputs":[{"internalType":"address","name":"_teeAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"AlreadyRevealed","type":"error"},{"inputs":[],"name":"AlreadySealed","type":"error"},{"inputs":[],"name":"BadTeeSignature","type":"error"},{"inputs":[],"name":"BiddingClosed","type":"error"},{"inputs":[],"name":"DeadlineNotReached","type":"error"},{"inputs":[],"name":"ECDSAInvalidSignature","type":"error"},{"inputs":[{"internalType":"uint256","name":"length","type":"uint256"}],"name":"ECDSAInvalidSignatureLength","type":"error"},{"inputs":[{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"ECDSAInvalidSignatureS","type":"error"},{"inputs":[],"name":"NotOwner","type":"error"},{"inputs":[],"name":"UnknownListing","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":true,"internalType":"address","name":"winner","type":"address"},{"indexed":false,"internalType":"uint256","name":"winningAmount","type":"uint256"},{"indexed":false,"internalType":"bytes32","name":"resultHash","type":"bytes32"}],"name":"BidRevealed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":true,"internalType":"address","name":"bidder","type":"address"},{"indexed":false,"internalType":"bytes32","name":"termsCommitment","type":"bytes32"}],"name":"BidSealed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":true,"internalType":"address","name":"creator","type":"address"},{"indexed":false,"internalType":"uint64","name":"deadline","type":"uint64"}],"name":"ListingCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"RevealRequested","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"teeAddress","type":"address"}],"name":"TeeAddressUpdated","type":"event"},{"inputs":[],"name":"OP_COMMAND_REVEAL","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"OP_COMMAND_SEAL","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"OP_TYPE_BID","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"TEE_ACTION_RESULT_PREFIX","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"bidders","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint64","name":"deadline","type":"uint64"}],"name":"createListing","outputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"getBidders","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"listingCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"listings","outputs":[{"internalType":"address","name":"creator","type":"address"},{"internalType":"uint64","name":"deadline","type":"uint64"},{"internalType":"bool","name":"revealed","type":"bool"},{"internalType":"address","name":"winner","type":"address"},{"internalType":"uint256","name":"winningAmount","type":"uint256"},{"internalType":"bytes32","name":"resultHash","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"requestReveal","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"address","name":"","type":"address"}],"name":"sealedBids","outputs":[{"internalType":"bytes32","name":"termsCommitment","type":"bytes32"},{"internalType":"bytes","name":"encryptedTerms","type":"bytes"},{"internalType":"bool","name":"submitted","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_teeAddress","type":"address"}],"name":"setTeeAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"},{"internalType":"address","name":"winner","type":"address"},{"internalType":"uint256","name":"winningAmount","type":"uint256"},{"internalType":"bytes32","name":"resultHash","type":"bytes32"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"submitRevealResult","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"},{"internalType":"bytes32","name":"termsCommitment","type":"bytes32"},{"internalType":"bytes","name":"encryptedTerms","type":"bytes"}],"name":"submitSealedBid","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"teeAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];

export const VEIL_BIDDING_ADDRESS = import.meta.env.VITE_VEILBIDDING_ADDRESS ?? "";

export function isContractConfigured() {
  return Boolean(VEIL_BIDDING_ADDRESS);
}

export function getVeilBiddingContract(signerOrProvider) {
  if (!VEIL_BIDDING_ADDRESS) {
    throw new Error("VITE_VEILBIDDING_ADDRESS is not set — deploy the contract and add it to .env first.");
  }
  return new Contract(VEIL_BIDDING_ADDRESS, VEIL_BIDDING_ABI, signerOrProvider);
}

export async function getBrowserSigner() {
  if (!window.ethereum) throw new Error("No wallet provider found.");
  const provider = new BrowserProvider(window.ethereum);
  return provider.getSigner();
}

let readOnlyProvider;

/// A plain RPC connection for reading public contract state — works even
/// without a connected wallet, so anyone (including judges) can verify
/// on-chain proof without installing anything.
export function getReadOnlyProvider() {
  if (!readOnlyProvider) {
    readOnlyProvider = new JsonRpcProvider(COSTON2_PARAMS.rpcUrls[0]);
  }
  return readOnlyProvider;
}

export function getReadOnlyContract() {
  return getVeilBiddingContract(getReadOnlyProvider());
}

/// Fetches live on-chain state for a listing plus the settlement tx hash
/// (from the BidRevealed event log) once revealed.
export async function fetchOnChainListing(listingId) {
  const contract = getReadOnlyContract();
  const listing = await contract.listings(listingId);

  const result = {
    revealed: listing.revealed,
    winner: listing.winner,
    winningAmount: listing.winningAmount,
    resultHash: listing.resultHash,
    txHash: null,
  };

  if (listing.revealed) {
    const filter = contract.filters.BidRevealed(listingId);
    const events = await contract.queryFilter(filter);
    result.txHash = events[events.length - 1]?.transactionHash ?? null;
  }

  return result;
}
