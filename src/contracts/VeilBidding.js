import { Contract, BrowserProvider, JsonRpcProvider } from "ethers";

import { COSTON2_PARAMS } from "../utils/network";

// ABI extracted from the real deployed contract — fce-veil-bid/out/InstructionSender.sol/VeilBidding.json.
// Keep in sync if the contract changes and is redeployed.
export const VEIL_BIDDING_ABI = [{"type":"constructor","inputs":[{"name":"_teeExtensionRegistry","type":"address","internalType":"contract ITeeExtensionRegistry"},{"name":"_teeMachineRegistry","type":"address","internalType":"contract ITeeMachineRegistry"}],"stateMutability":"nonpayable"},{"type":"function","name":"OP_COMMAND_REVEAL","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"OP_TYPE_BID","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"TEE_EXTENSION_REGISTRY","inputs":[],"outputs":[{"name":"","type":"address","internalType":"contract ITeeExtensionRegistry"}],"stateMutability":"view"},{"type":"function","name":"TEE_MACHINE_REGISTRY","inputs":[],"outputs":[{"name":"","type":"address","internalType":"contract ITeeMachineRegistry"}],"stateMutability":"view"},{"type":"function","name":"bidders","inputs":[{"name":"","type":"uint256","internalType":"uint256"},{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"createListing","inputs":[{"name":"_deadline","type":"uint64","internalType":"uint64"}],"outputs":[{"name":"listingId","type":"uint256","internalType":"uint256"}],"stateMutability":"nonpayable"},{"type":"function","name":"getBidders","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address[]","internalType":"address[]"}],"stateMutability":"view"},{"type":"function","name":"listingCount","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"listings","inputs":[{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"creator","type":"address","internalType":"address"},{"name":"deadline","type":"uint64","internalType":"uint64"},{"name":"revealed","type":"bool","internalType":"bool"},{"name":"winner","type":"address","internalType":"address"},{"name":"winningAmount","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"requestReveal","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"instructionId","type":"bytes32","internalType":"bytes32"}],"stateMutability":"payable"},{"type":"function","name":"sealedBids","inputs":[{"name":"","type":"uint256","internalType":"uint256"},{"name":"","type":"address","internalType":"address"}],"outputs":[{"name":"termsCommitment","type":"bytes32","internalType":"bytes32"},{"name":"encryptedTerms","type":"bytes","internalType":"bytes"},{"name":"submitted","type":"bool","internalType":"bool"}],"stateMutability":"view"},{"type":"function","name":"setExtensionId","inputs":[],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"setTeeAddress","inputs":[{"name":"_teeAddress","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"submitRevealResult","inputs":[{"name":"_resultData","type":"bytes","internalType":"bytes"},{"name":"_actionId","type":"bytes32","internalType":"bytes32"},{"name":"_submissionTag","type":"string","internalType":"string"},{"name":"_status","type":"uint8","internalType":"uint8"},{"name":"_signature","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"submitSealedBid","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"},{"name":"_termsCommitment","type":"bytes32","internalType":"bytes32"},{"name":"_encryptedTerms","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"teeAddress","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"event","name":"BidRevealed","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"winner","type":"address","indexed":true,"internalType":"address"},{"name":"winningAmount","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"BidSealed","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"bidder","type":"address","indexed":true,"internalType":"address"},{"name":"termsCommitment","type":"bytes32","indexed":false,"internalType":"bytes32"}],"anonymous":false},{"type":"event","name":"ListingCreated","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"creator","type":"address","indexed":true,"internalType":"address"},{"name":"deadline","type":"uint64","indexed":false,"internalType":"uint64"}],"anonymous":false},{"type":"event","name":"RevealRequested","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"instructionId","type":"bytes32","indexed":false,"internalType":"bytes32"}],"anonymous":false},{"type":"event","name":"TeeAddressSet","inputs":[{"name":"teeAddress","type":"address","indexed":true,"internalType":"address"}],"anonymous":false}];

// Real VeilBidding deployment on Coston2, registered against the live
// FlareTeeManager (extension ID 0x10128). Override via .env if redeployed.
const DEFAULT_ADDRESS = "0xB7826322c981fCeAC2d76158f49f76a14574b5C9";
export const VEIL_BIDDING_ADDRESS = import.meta.env.VITE_VEILBIDDING_ADDRESS || DEFAULT_ADDRESS;

// Block the contract was deployed at — scopes event queries so we don't scan
// from genesis on every page load.
export const DEPLOY_BLOCK = Number(import.meta.env.VITE_VEILBIDDING_DEPLOY_BLOCK || 33431280);

// Wei value forwarded to sendInstructions when requesting a reveal — mirrors
// the Go tooling's DefaultFee (tools/pkg/utils/instructions.go).
export const INSTRUCTION_FEE_WEI = 1_000_000_000_000n;

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

/// Fetches live on-chain state for a single listing: creator, deadline,
/// revealed/winner/winningAmount, plus the settlement tx hash (from the
/// BidRevealed event log) once revealed.
export async function fetchOnChainListing(listingId) {
  const contract = getReadOnlyContract();
  const listing = await contract.listings(listingId);

  const result = {
    creator: listing.creator,
    deadline: listing.deadline,
    revealed: listing.revealed,
    winner: listing.winner,
    winningAmount: listing.winningAmount,
    txHash: null,
  };

  if (listing.revealed) {
    const filter = contract.filters.BidRevealed(listingId);
    const events = await contract.queryFilter(filter);
    result.txHash = events[events.length - 1]?.transactionHash ?? null;
  }

  return result;
}

// Coston2's public RPC caps eth_getLogs at 30 blocks per call — querying any
// meaningful range means paging through in small chunks.
const LOG_CHUNK_SIZE = 25;
const LISTINGS_CACHE_KEY = "veilpay:listing-events-cache";

async function queryLogsChunked(contract, filter, fromBlock, toBlock) {
  const events = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK_SIZE) {
    const end = Math.min(start + LOG_CHUNK_SIZE - 1, toBlock);
    const chunk = await contract.queryFilter(filter, start, end);
    events.push(...chunk);
  }
  return events;
}

function loadListingsCache() {
  try {
    return JSON.parse(localStorage.getItem(LISTINGS_CACHE_KEY)) ?? null;
  } catch {
    return null;
  }
}

function saveListingsCache(cache) {
  localStorage.setItem(LISTINGS_CACHE_KEY, JSON.stringify(cache));
}

/// Discovers every listing ever created on-chain via ListingCreated events —
/// the source of truth for "which listings exist", since a listing created
/// from one browser/account must still be visible (and biddable) from any
/// other. Caches results + last-synced block in localStorage so repeat loads
/// only scan new blocks, since the public RPC's 30-block eth_getLogs cap
/// makes a full historical scan expensive. Returns
/// [{ listingId, creator, deadline, txHash }], oldest first.
export async function fetchAllListings() {
  const contract = getReadOnlyContract();
  const provider = getReadOnlyProvider();
  const currentBlock = await provider.getBlockNumber();

  const cache = loadListingsCache();
  const fromBlock = cache && cache.lastBlock >= DEPLOY_BLOCK ? cache.lastBlock + 1 : DEPLOY_BLOCK;
  const cachedEvents = cache?.events ?? [];

  let newRaw = [];
  if (fromBlock <= currentBlock) {
    const filter = contract.filters.ListingCreated();
    newRaw = await queryLogsChunked(contract, filter, fromBlock, currentBlock);
  }

  const newEvents = newRaw.map((event) => ({
    listingId: event.args.listingId.toString(),
    creator: event.args.creator,
    deadline: event.args.deadline.toString(),
    txHash: event.transactionHash,
  }));

  const merged = [...cachedEvents, ...newEvents];
  saveListingsCache({ lastBlock: currentBlock, events: merged });

  return merged.map((e) => ({
    listingId: BigInt(e.listingId),
    creator: e.creator,
    deadline: BigInt(e.deadline),
    txHash: e.txHash,
  }));
}

/// Every bidder address that sealed a bid on a listing.
export async function fetchBidders(listingId) {
  const contract = getReadOnlyContract();
  return contract.getBidders(listingId);
}

/// A single bidder's sealed bid: on-chain commitment + ECIES ciphertext
/// (still opaque without the TEE's private key) + whether they've sealed at all.
export async function fetchSealedBid(listingId, bidder) {
  const contract = getReadOnlyContract();
  const sealed = await contract.sealedBids(listingId, bidder);
  return {
    termsCommitment: sealed.termsCommitment,
    encryptedTerms: sealed.encryptedTerms,
    submitted: sealed.submitted,
  };
}
