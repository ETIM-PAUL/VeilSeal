import { Contract, BrowserProvider, JsonRpcProvider } from "ethers";

import { COSTON2_PARAMS } from "../utils/network";

// ABI extracted from the real deployed contract - fce-veil-bid/out/InstructionSender.sol/VeilBidding.json.
// Keep in sync if the contract changes and is redeployed.
export const VEIL_BIDDING_ABI = [{"type":"constructor","inputs":[{"name":"_teeExtensionRegistry","type":"address","internalType":"contract ITeeExtensionRegistry"},{"name":"_teeMachineRegistry","type":"address","internalType":"contract ITeeMachineRegistry"}],"stateMutability":"nonpayable"},{"type":"function","name":"CANCEL_FEE","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"MAX_SCORE","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"MIN_SCORE_THRESHOLD","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"OP_COMMAND_MY_SCORE","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"OP_COMMAND_REVEAL","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"OP_COMMAND_SCORE","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"OP_COMMAND_STEALTH_REVEAL","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"OP_TYPE_BID","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"TEE_EXTENSION_REGISTRY","inputs":[],"outputs":[{"name":"","type":"address","internalType":"contract ITeeExtensionRegistry"}],"stateMutability":"view"},{"type":"function","name":"TEE_MACHINE_REGISTRY","inputs":[],"outputs":[{"name":"","type":"address","internalType":"contract ITeeMachineRegistry"}],"stateMutability":"view"},{"type":"function","name":"addParticipants","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"},{"name":"_participants","type":"address[]","internalType":"address[]"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"addStealthParticipants","inputs":[{"name":"_hashedId","type":"bytes32","internalType":"bytes32"},{"name":"_participants","type":"address[]","internalType":"address[]"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"bidders","inputs":[{"name":"","type":"uint256","internalType":"uint256"},{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"cancelSealedBid","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"payable"},{"type":"function","name":"createListing","inputs":[{"name":"_title","type":"string","internalType":"string"},{"name":"_description","type":"string","internalType":"string"},{"name":"_itemType","type":"string","internalType":"string"},{"name":"_ipfsHash","type":"string","internalType":"string"},{"name":"_minBid","type":"uint256","internalType":"uint256"},{"name":"_minScore","type":"uint256","internalType":"uint256"},{"name":"_inviteOnly","type":"bool","internalType":"bool"},{"name":"_deadline","type":"uint64","internalType":"uint64"},{"name":"_initialParticipants","type":"address[]","internalType":"address[]"}],"outputs":[{"name":"listingId","type":"uint256","internalType":"uint256"}],"stateMutability":"nonpayable"},{"type":"function","name":"createStealthListing","inputs":[{"name":"_encryptedDetails","type":"bytes","internalType":"bytes"},{"name":"_deadline","type":"uint64","internalType":"uint64"},{"name":"_initialParticipants","type":"address[]","internalType":"address[]"}],"outputs":[{"name":"hashedId","type":"bytes32","internalType":"bytes32"}],"stateMutability":"nonpayable"},{"type":"function","name":"creatorStealthNonce","inputs":[{"name":"","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"getBidders","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address[]","internalType":"address[]"}],"stateMutability":"view"},{"type":"function","name":"getStealthBidders","inputs":[{"name":"_hashedId","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"","type":"address[]","internalType":"address[]"}],"stateMutability":"view"},{"type":"function","name":"isParticipant","inputs":[{"name":"","type":"uint256","internalType":"uint256"},{"name":"","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"bool","internalType":"bool"}],"stateMutability":"view"},{"type":"function","name":"isStealthParticipant","inputs":[{"name":"","type":"bytes32","internalType":"bytes32"},{"name":"","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"bool","internalType":"bool"}],"stateMutability":"view"},{"type":"function","name":"listingCount","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"listingMinBid","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"listingMinScore","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"listings","inputs":[{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"creator","type":"address","internalType":"address"},{"name":"deadline","type":"uint64","internalType":"uint64"},{"name":"revealed","type":"bool","internalType":"bool"},{"name":"winner","type":"address","internalType":"address"},{"name":"winningAmount","type":"uint256","internalType":"uint256"},{"name":"title","type":"string","internalType":"string"},{"name":"description","type":"string","internalType":"string"},{"name":"itemType","type":"string","internalType":"string"},{"name":"ipfsHash","type":"string","internalType":"string"},{"name":"minBid","type":"uint256","internalType":"uint256"},{"name":"minScore","type":"uint256","internalType":"uint256"},{"name":"inviteOnly","type":"bool","internalType":"bool"}],"stateMutability":"view"},{"type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"requestMyScore","inputs":[],"outputs":[{"name":"instructionId","type":"bytes32","internalType":"bytes32"}],"stateMutability":"payable"},{"type":"function","name":"requestReveal","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"instructionId","type":"bytes32","internalType":"bytes32"}],"stateMutability":"payable"},{"type":"function","name":"requestScoreCheck","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"},{"name":"_termsCommitment","type":"bytes32","internalType":"bytes32"},{"name":"_encryptedTerms","type":"bytes","internalType":"bytes"}],"outputs":[{"name":"instructionId","type":"bytes32","internalType":"bytes32"}],"stateMutability":"payable"},{"type":"function","name":"requestStealthReveal","inputs":[{"name":"_hashedId","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"instructionId","type":"bytes32","internalType":"bytes32"}],"stateMutability":"payable"},{"type":"function","name":"sealedBids","inputs":[{"name":"","type":"uint256","internalType":"uint256"},{"name":"","type":"address","internalType":"address"}],"outputs":[{"name":"termsCommitment","type":"bytes32","internalType":"bytes32"},{"name":"encryptedTerms","type":"bytes","internalType":"bytes"},{"name":"submitted","type":"bool","internalType":"bool"}],"stateMutability":"view"},{"type":"function","name":"setExtensionId","inputs":[],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"setTeeAddress","inputs":[{"name":"_teeAddress","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"stealthBidders","inputs":[{"name":"","type":"bytes32","internalType":"bytes32"},{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"stealthListings","inputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"creator","type":"address","internalType":"address"},{"name":"deadline","type":"uint64","internalType":"uint64"},{"name":"revealed","type":"bool","internalType":"bool"},{"name":"winner","type":"address","internalType":"address"},{"name":"winningAmount","type":"uint256","internalType":"uint256"},{"name":"encryptedDetails","type":"bytes","internalType":"bytes"}],"stateMutability":"view"},{"type":"function","name":"stealthSealedBids","inputs":[{"name":"","type":"bytes32","internalType":"bytes32"},{"name":"","type":"address","internalType":"address"}],"outputs":[{"name":"termsCommitment","type":"bytes32","internalType":"bytes32"},{"name":"encryptedTerms","type":"bytes","internalType":"bytes"},{"name":"submitted","type":"bool","internalType":"bool"}],"stateMutability":"view"},{"type":"function","name":"submitRevealResult","inputs":[{"name":"_resultData","type":"bytes","internalType":"bytes"},{"name":"_actionId","type":"bytes32","internalType":"bytes32"},{"name":"_submissionTag","type":"string","internalType":"string"},{"name":"_status","type":"uint8","internalType":"uint8"},{"name":"_signature","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"submitSealedBid","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"},{"name":"_termsCommitment","type":"bytes32","internalType":"bytes32"},{"name":"_encryptedTerms","type":"bytes","internalType":"bytes"},{"name":"_attestation","type":"tuple","internalType":"struct VeilBidding.EligibilityAttestation","components":[{"name":"data","type":"bytes","internalType":"bytes"},{"name":"actionId","type":"bytes32","internalType":"bytes32"},{"name":"submissionTag","type":"string","internalType":"string"},{"name":"status","type":"uint8","internalType":"uint8"},{"name":"signature","type":"bytes","internalType":"bytes"}]}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"submitStealthRevealResult","inputs":[{"name":"_resultData","type":"bytes","internalType":"bytes"},{"name":"_actionId","type":"bytes32","internalType":"bytes32"},{"name":"_submissionTag","type":"string","internalType":"string"},{"name":"_status","type":"uint8","internalType":"uint8"},{"name":"_signature","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"submitStealthSealedBid","inputs":[{"name":"_hashedId","type":"bytes32","internalType":"bytes32"},{"name":"_termsCommitment","type":"bytes32","internalType":"bytes32"},{"name":"_encryptedTerms","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"teeAddress","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"totalBidsPlaced","inputs":[{"name":"","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"withdrawFees","inputs":[{"name":"_to","type":"address","internalType":"address payable"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"event","name":"BidCancelled","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"bidder","type":"address","indexed":true,"internalType":"address"},{"name":"fee","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"BidRevealed","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"winner","type":"address","indexed":true,"internalType":"address"},{"name":"winningAmount","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"BidSealed","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"bidder","type":"address","indexed":true,"internalType":"address"},{"name":"termsCommitment","type":"bytes32","indexed":false,"internalType":"bytes32"}],"anonymous":false},{"type":"event","name":"ListingCreated","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"creator","type":"address","indexed":true,"internalType":"address"},{"name":"deadline","type":"uint64","indexed":false,"internalType":"uint64"},{"name":"title","type":"string","indexed":false,"internalType":"string"},{"name":"description","type":"string","indexed":false,"internalType":"string"},{"name":"itemType","type":"string","indexed":false,"internalType":"string"},{"name":"ipfsHash","type":"string","indexed":false,"internalType":"string"},{"name":"minBid","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"minScore","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"inviteOnly","type":"bool","indexed":false,"internalType":"bool"}],"anonymous":false},{"type":"event","name":"MyScoreRequested","inputs":[{"name":"wallet","type":"address","indexed":true,"internalType":"address"},{"name":"instructionId","type":"bytes32","indexed":false,"internalType":"bytes32"}],"anonymous":false},{"type":"event","name":"ParticipantsAdded","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"participants","type":"address[]","indexed":false,"internalType":"address[]"}],"anonymous":false},{"type":"event","name":"RevealRequested","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"instructionId","type":"bytes32","indexed":false,"internalType":"bytes32"}],"anonymous":false},{"type":"event","name":"ScoreCheckRequested","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"bidder","type":"address","indexed":true,"internalType":"address"},{"name":"instructionId","type":"bytes32","indexed":false,"internalType":"bytes32"}],"anonymous":false},{"type":"event","name":"StealthBidRevealed","inputs":[{"name":"hashedId","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"winner","type":"address","indexed":true,"internalType":"address"},{"name":"winningAmount","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"StealthBidSealed","inputs":[{"name":"hashedId","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"bidder","type":"address","indexed":true,"internalType":"address"},{"name":"termsCommitment","type":"bytes32","indexed":false,"internalType":"bytes32"}],"anonymous":false},{"type":"event","name":"StealthListingCreated","inputs":[{"name":"hashedId","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"creator","type":"address","indexed":true,"internalType":"address"},{"name":"deadline","type":"uint64","indexed":false,"internalType":"uint64"}],"anonymous":false},{"type":"event","name":"StealthParticipantsAdded","inputs":[{"name":"hashedId","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"participants","type":"address[]","indexed":false,"internalType":"address[]"}],"anonymous":false},{"type":"event","name":"StealthRevealRequested","inputs":[{"name":"hashedId","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"instructionId","type":"bytes32","indexed":false,"internalType":"bytes32"}],"anonymous":false},{"type":"event","name":"TeeAddressSet","inputs":[{"name":"teeAddress","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},{"type":"function","name":"OP_TYPE_CIPHER","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"OP_COMMAND_CIPHER_REVEAL","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"addCipherParticipants","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"},{"name":"_participants","type":"address[]","internalType":"address[]"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"cipherGuessers","inputs":[{"name":"","type":"uint256","internalType":"uint256"},{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"cipherListingCount","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"cipherListings","inputs":[{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"creator","type":"address","internalType":"address"},{"name":"deadline","type":"uint64","internalType":"uint64"},{"name":"revealed","type":"bool","internalType":"bool"},{"name":"winner","type":"address","internalType":"address"},{"name":"wordCount","type":"uint8","internalType":"uint8"},{"name":"title","type":"string","internalType":"string"},{"name":"description","type":"string","internalType":"string"},{"name":"itemType","type":"string","internalType":"string"},{"name":"ipfsHash","type":"string","internalType":"string"}],"stateMutability":"view"},{"type":"function","name":"cipherSealedGuesses","inputs":[{"name":"","type":"uint256","internalType":"uint256"},{"name":"","type":"address","internalType":"address"}],"outputs":[{"name":"guessCommitment","type":"bytes32","internalType":"bytes32"},{"name":"encryptedGuess","type":"bytes","internalType":"bytes"},{"name":"submitted","type":"bool","internalType":"bool"}],"stateMutability":"view"},{"type":"function","name":"cipherTrueArrangement","inputs":[{"name":"","type":"uint256","internalType":"uint256"},{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"uint8","internalType":"uint8"}],"stateMutability":"view"},{"type":"function","name":"cipherWinnerArrangement","inputs":[{"name":"","type":"uint256","internalType":"uint256"},{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"uint8","internalType":"uint8"}],"stateMutability":"view"},{"type":"function","name":"cipherWords","inputs":[{"name":"","type":"uint256","internalType":"uint256"},{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"string","internalType":"string"}],"stateMutability":"view"},{"type":"function","name":"createCipherListing","inputs":[{"name":"_title","type":"string","internalType":"string"},{"name":"_description","type":"string","internalType":"string"},{"name":"_itemType","type":"string","internalType":"string"},{"name":"_ipfsHash","type":"string","internalType":"string"},{"name":"_words","type":"string[]","internalType":"string[]"},{"name":"_deadline","type":"uint64","internalType":"uint64"},{"name":"_initialParticipants","type":"address[]","internalType":"address[]"}],"outputs":[{"name":"listingId","type":"uint256","internalType":"uint256"}],"stateMutability":"nonpayable"},{"type":"function","name":"getCipherGuessers","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address[]","internalType":"address[]"}],"stateMutability":"view"},{"type":"function","name":"getCipherTrueArrangement","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"uint8[]","internalType":"uint8[]"}],"stateMutability":"view"},{"type":"function","name":"getCipherWinnerArrangement","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"uint8[]","internalType":"uint8[]"}],"stateMutability":"view"},{"type":"function","name":"getCipherWords","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"string[]","internalType":"string[]"}],"stateMutability":"view"},{"type":"function","name":"isCipherParticipant","inputs":[{"name":"","type":"uint256","internalType":"uint256"},{"name":"","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"bool","internalType":"bool"}],"stateMutability":"view"},{"type":"function","name":"requestCipherReveal","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"instructionId","type":"bytes32","internalType":"bytes32"}],"stateMutability":"payable"},{"type":"function","name":"submitCipherGuess","inputs":[{"name":"_listingId","type":"uint256","internalType":"uint256"},{"name":"_guessCommitment","type":"bytes32","internalType":"bytes32"},{"name":"_encryptedGuess","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"submitCipherRevealResult","inputs":[{"name":"_resultData","type":"bytes","internalType":"bytes"},{"name":"_actionId","type":"bytes32","internalType":"bytes32"},{"name":"_submissionTag","type":"string","internalType":"string"},{"name":"_status","type":"uint8","internalType":"uint8"},{"name":"_signature","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"event","name":"CipherGuessSealed","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"guesser","type":"address","indexed":true,"internalType":"address"},{"name":"guessCommitment","type":"bytes32","indexed":false,"internalType":"bytes32"}],"anonymous":false},{"type":"event","name":"CipherListingCreated","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"creator","type":"address","indexed":true,"internalType":"address"},{"name":"deadline","type":"uint64","indexed":false,"internalType":"uint64"},{"name":"title","type":"string","indexed":false,"internalType":"string"},{"name":"description","type":"string","indexed":false,"internalType":"string"},{"name":"itemType","type":"string","indexed":false,"internalType":"string"},{"name":"ipfsHash","type":"string","indexed":false,"internalType":"string"},{"name":"wordCount","type":"uint8","indexed":false,"internalType":"uint8"},{"name":"words","type":"string[]","indexed":false,"internalType":"string[]"}],"anonymous":false},{"type":"event","name":"CipherListingRevealed","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"winner","type":"address","indexed":true,"internalType":"address"},{"name":"winnerArrangement","type":"uint8[]","indexed":false,"internalType":"uint8[]"},{"name":"trueArrangement","type":"uint8[]","indexed":false,"internalType":"uint8[]"}],"anonymous":false},{"type":"event","name":"CipherParticipantsAdded","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"participants","type":"address[]","indexed":false,"internalType":"address[]"}],"anonymous":false},{"type":"event","name":"CipherRevealRequested","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"instructionId","type":"bytes32","indexed":false,"internalType":"bytes32"}],"anonymous":false}];

// Real VeilBidding deployment on Coston2, registered against the live
// FlareTeeManager. Override via .env if redeployed. Listing metadata
// (title/description/type/ipfsHash/minBid/minScore/inviteOnly) is stored
// on-chain - no off-chain index or localStorage cache required to render a listing.
//
// Redeployed 2026-08-12 to reset to a clean listing slate (contracts aren't
// upgradeable, so wiping state means a new address) - listings on the
// previous address (0x9A0b1c0209eCa8417dCecf417b44187398613531) are no
// longer reachable from this app, though they still exist on-chain.
const DEFAULT_ADDRESS = "0x16b4abf6e8BF61477864233F37Bb58eb78379fcb";
export const VEIL_BIDDING_ADDRESS = import.meta.env.VITE_VEILBIDDING_ADDRESS || DEFAULT_ADDRESS;

// Block the contract was deployed at - scopes event queries so we don't scan
// from genesis on every page load.
export const DEPLOY_BLOCK = Number(import.meta.env.VITE_VEILBIDDING_DEPLOY_BLOCK || 33983228);

// Mirrors the contract's MIN_SCORE_THRESHOLD/MAX_SCORE constants.
export const MIN_SCORE_THRESHOLD = 5;
export const MAX_SCORE = 100;

// Mirrors the contract's CANCEL_FEE constant (0.1 native token) - charged to
// cancel a still-open sealed bid before a listing's deadline.
export const CANCEL_FEE_WEI = 100_000_000_000_000_000n; // 0.1 ether in wei

// Empty attestation - passed to submitSealedBid when a listing isn't
// score-gated, or the caller is an invited participant (bypasses the gate
// entirely). The contract never inspects it in either case.
export const EMPTY_ATTESTATION = {
  data: "0x",
  actionId: `0x${"0".repeat(64)}`,
  submissionTag: "",
  status: 0,
  signature: "0x",
};

// Wei value forwarded to sendInstructions when requesting a reveal - mirrors
// the Go tooling's DefaultFee (tools/pkg/utils/instructions.go).
export const INSTRUCTION_FEE_WEI = 1_000_000_000_000n;

export function isContractConfigured() {
  return Boolean(VEIL_BIDDING_ADDRESS);
}

export function getVeilBiddingContract(signerOrProvider) {
  if (!VEIL_BIDDING_ADDRESS) {
    throw new Error("VITE_VEILBIDDING_ADDRESS is not set - deploy the contract and add it to .env first.");
  }
  return new Contract(VEIL_BIDDING_ADDRESS, VEIL_BIDDING_ABI, signerOrProvider);
}

export async function getBrowserSigner() {
  if (!window.ethereum) throw new Error("No wallet provider found.");
  const provider = new BrowserProvider(window.ethereum);
  return provider.getSigner();
}

let readOnlyProvider;

/// A plain RPC connection for reading public contract state - works even
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

// Coston2's public RPC caps eth_getLogs at 30 blocks per call. Scanning
// forward from a now-hours-old DEPLOY_BLOCK to "latest" means hundreds of
// sequential chunk requests - enough to get rate-limited/dropped by the
// public RPC outright. A reveal we're looking up just happened (that's the
// whole reason the caller wants its tx hash), so search backward from the
// current block instead and stop at the first match - the common case
// resolves in one or two requests. Bounded so a very old/never-found event
// still gives up instead of scanning forever.
const BACKWARD_SEARCH_MAX_CHUNKS = 40; // ~1000 blocks of history

async function findLatestLogBackward(contract, filter, fromBlock, toBlock) {
  let end = toBlock;
  for (let i = 0; i < BACKWARD_SEARCH_MAX_CHUNKS && end >= fromBlock; i++) {
    const start = Math.max(end - LOG_CHUNK_SIZE + 1, fromBlock);
    const chunk = await contract.queryFilter(filter, start, end);
    if (chunk.length > 0) return chunk[chunk.length - 1];
    end = start - 1;
  }
  return null;
}

/// Fetches live on-chain state for a single listing: creator, deadline,
/// revealed/winner/winningAmount, item metadata (title/description/
/// itemType/ipfsHash/minBid), plus the settlement tx hash (from the
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
    title: listing.title,
    description: listing.description,
    itemType: listing.itemType,
    ipfsHash: listing.ipfsHash,
    minBid: listing.minBid,
    minScore: listing.minScore,
    inviteOnly: listing.inviteOnly,
    txHash: null,
  };

  if (listing.revealed) {
    const provider = getReadOnlyProvider();
    const currentBlock = await provider.getBlockNumber();
    const filter = contract.filters.BidRevealed(listingId);
    const event = await findLatestLogBackward(contract, filter, DEPLOY_BLOCK, currentBlock).catch(() => null);
    result.txHash = event?.transactionHash ?? null;
  }

  return result;
}

// Coston2's public RPC caps eth_getLogs at 30 blocks per call - querying any
// meaningful range means paging through in small chunks. Still used by
// fetchBidActivity below, which has no sequential on-chain counter to
// substitute (unlike listings/cipher listings - see fetchAllListings).
const LOG_CHUNK_SIZE = 25;
// Measured against the live Coston2 public RPC: 20 concurrent eth_getLogs
// calls, 3 batches of 60, completed in ~1.5s total with zero errors (40
// concurrent was also clean, but this leaves headroom on a shared public
// endpoint). Strictly sequential is ~0.5s/call - a full cold scan (thousands
// of chunks once enough blocks have passed since deploy) is minutes at this
// concurrency vs. hours sequential.
const CHUNK_CONCURRENCY = 20;

async function queryLogsChunked(contract, filter, fromBlock, toBlock) {
  const starts = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK_SIZE) {
    starts.push(start);
  }

  const chunks = new Array(starts.length);
  let next = 0;
  async function worker() {
    while (next < starts.length) {
      const i = next++;
      const end = Math.min(starts[i] + LOG_CHUNK_SIZE - 1, toBlock);
      chunks[i] = await contract.queryFilter(filter, starts[i], end);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, starts.length) }, worker));
  return chunks.flat();
}

/// Discovers every listing ever created on-chain - the source of truth for
/// "which listings exist", since a listing created from one browser/account
/// must still be visible (and biddable) from any other. Listing IDs are
/// assigned sequentially from the contract's own counter (`listingId =
/// ++listingCount`, see InstructionSender.sol), so every listing's full data
/// is just `listingCount()` + one `listings(id)` view call per ID - no event
/// scan needed. (This used to scan ListingCreated events in 25-block chunks
/// from the deploy block, which is why the cache/chunking machinery below
/// still exists for fetchBidActivity: with tens of thousands of blocks
/// elapsed since deploy, a cold scan took on the order of hours and looked
/// like the listings page was stuck.) Creation tx hash/block number aren't
/// stored on-chain and would need that same event scan to recover, so they're
/// left null here - callers already have a graceful fallback for that (see
/// buildOperationsFeed's "On-chain" display case). Returns [{ listingId,
/// creator, deadline, title, description, itemType, ipfsHash, minBid,
/// minScore, inviteOnly, txHash: null, blockNumber: null }].
export async function fetchAllListings() {
  const contract = getReadOnlyContract();
  const count = Number(await contract.listingCount());
  if (count === 0) return [];

  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const raw = await Promise.all(ids.map((id) => contract.listings(id)));

  return raw.map((listing, i) => ({
    listingId: BigInt(ids[i]),
    creator: listing.creator,
    deadline: listing.deadline,
    title: listing.title,
    description: listing.description,
    itemType: listing.itemType,
    ipfsHash: listing.ipfsHash,
    minBid: listing.minBid,
    minScore: listing.minScore,
    inviteOnly: Boolean(listing.inviteOnly),
    txHash: null,
    blockNumber: null,
  }));
}

// Scoped by contract address + schema version so a redeploy never merges
// stale cached events with a different contract's/schema's data.
const BID_ACTIVITY_CACHE_KEY = `veilseal:bid-activity-cache:v1:${VEIL_BIDDING_ADDRESS}`;

function loadBidActivityCache() {
  try {
    return JSON.parse(localStorage.getItem(BID_ACTIVITY_CACHE_KEY)) ?? null;
  } catch {
    return null;
  }
}

function saveBidActivityCache(cache) {
  localStorage.setItem(BID_ACTIVITY_CACHE_KEY, JSON.stringify(cache));
}

// The Operations/Dashboard activity feed only needs to show recent activity,
// so the scan is capped to a trailing window instead of "since deploy" -
// otherwise every day that passes makes the cold-scan (any browser without a
// warm localStorage cache) permanently more expensive. ~1.71s/block measured
// live against Coston2 (100k-block sample via eth_getBlockByNumber); computed
// from wall-clock days rather than a hardcoded block count so it stays right
// if Coston2's block time drifts.
const ACTIVITY_LOOKBACK_DAYS = 3;
const COSTON2_AVG_BLOCK_TIME_SEC = 1.71;
const ACTIVITY_LOOKBACK_BLOCKS = Math.round((ACTIVITY_LOOKBACK_DAYS * 86400) / COSTON2_AVG_BLOCK_TIME_SEC);

/// Discovers sealed-bid activity - BidSealed (a bid was committed) and
/// BidCancelled (withdrawn before reveal) - for standard listings, over the
/// last ACTIVITY_LOOKBACK_DAYS. Each event carries a real tx hash and block
/// timestamp. The Operations page derives its feed from this plus the
/// already-fetched listings/participants state (see utils/operations.js)
/// instead of mock data. Cached in localStorage, pruned to the lookback
/// window on every call (so the window actually slides forward as events age
/// out, instead of just growing) and chunked with bounded concurrency via
/// queryLogsChunked - unlike listings, there's no on-chain counter for "how
/// many bid events exist", so this one genuinely has to scan Coston2's public
/// RPC in 25-block eth_getLogs windows.
///
/// Stealth listing activity is deliberately excluded - stealth listings are
/// meant to be undiscoverable without their hashedId, and surfacing "who
/// bid on what" in a globally-visible feed would defeat that even without
/// showing the listing's content.
export async function fetchBidActivity() {
  const contract = getReadOnlyContract();
  const provider = getReadOnlyProvider();
  const currentBlock = await provider.getBlockNumber();
  const windowStart = Math.max(DEPLOY_BLOCK, currentBlock - ACTIVITY_LOOKBACK_BLOCKS);

  const cache = loadBidActivityCache();
  const fromBlock = cache && cache.lastBlock >= windowStart ? cache.lastBlock + 1 : windowStart;
  // Drop anything that's aged out of the window, whether it came from an
  // older, wider cache (pre-lookback-cap) or has simply gotten stale since.
  const cachedEvents = (cache?.events ?? []).filter((e) => e.blockNumber >= windowStart);

  let newEvents = [];
  if (fromBlock <= currentBlock) {
    const [sealed, cancelled] = await Promise.all([
      queryLogsChunked(contract, contract.filters.BidSealed(), fromBlock, currentBlock),
      queryLogsChunked(contract, contract.filters.BidCancelled(), fromBlock, currentBlock),
    ]);

    const raw = [
      ...sealed.map((e) => ({
        kind: "Sealed",
        listingId: e.args.listingId.toString(),
        bidder: e.args.bidder,
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
      })),
      ...cancelled.map((e) => ({
        kind: "Cancelled",
        listingId: e.args.listingId.toString(),
        bidder: e.args.bidder,
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
      })),
    ];

    // Resolve each new event's block timestamp, deduped so a block with
    // several events in it only costs one RPC call.
    const uniqueBlocks = [...new Set(raw.map((e) => e.blockNumber))];
    const blocks = await Promise.all(uniqueBlocks.map((n) => provider.getBlock(n)));
    const timestampByBlock = new Map(uniqueBlocks.map((n, i) => [n, Number(blocks[i]?.timestamp ?? 0)]));
    newEvents = raw.map((e) => ({ ...e, timestamp: timestampByBlock.get(e.blockNumber) ?? 0 }));
  }

  const merged = [...cachedEvents, ...newEvents];
  saveBidActivityCache({ lastBlock: currentBlock, events: merged });

  return merged;
}

// Scoped by contract address + schema version, same reasoning as
// BID_ACTIVITY_CACHE_KEY.
const CIPHER_GUESS_ACTIVITY_CACHE_KEY = `veilseal:cipher-guess-activity-cache:v1:${VEIL_BIDDING_ADDRESS}`;

function loadCipherGuessActivityCache() {
  try {
    return JSON.parse(localStorage.getItem(CIPHER_GUESS_ACTIVITY_CACHE_KEY)) ?? null;
  } catch {
    return null;
  }
}

function saveCipherGuessActivityCache(cache) {
  localStorage.setItem(CIPHER_GUESS_ACTIVITY_CACHE_KEY, JSON.stringify(cache));
}

/// Discovers CipherGuessSealed activity over the last ACTIVITY_LOOKBACK_DAYS
/// - mirrors fetchBidActivity (same lookback window, cache, and bounded-
/// concurrency chunked scan), for the Operations/Dashboard feed's Cipher
/// Listings support. Unlike standard bids, there's no cancel/withdraw path
/// for a sealed cipher guess (submitCipherGuess has no counterpart to
/// cancelSealedBid), so there's only one event kind to scan here.
export async function fetchCipherGuessActivity() {
  const contract = getReadOnlyContract();
  const provider = getReadOnlyProvider();
  const currentBlock = await provider.getBlockNumber();
  const windowStart = Math.max(DEPLOY_BLOCK, currentBlock - ACTIVITY_LOOKBACK_BLOCKS);

  const cache = loadCipherGuessActivityCache();
  const fromBlock = cache && cache.lastBlock >= windowStart ? cache.lastBlock + 1 : windowStart;
  const cachedEvents = (cache?.events ?? []).filter((e) => e.blockNumber >= windowStart);

  let newEvents = [];
  if (fromBlock <= currentBlock) {
    const sealed = await queryLogsChunked(contract, contract.filters.CipherGuessSealed(), fromBlock, currentBlock);

    const raw = sealed.map((e) => ({
      listingId: e.args.listingId.toString(),
      guesser: e.args.guesser,
      txHash: e.transactionHash,
      blockNumber: e.blockNumber,
    }));

    const uniqueBlocks = [...new Set(raw.map((e) => e.blockNumber))];
    const blocks = await Promise.all(uniqueBlocks.map((n) => provider.getBlock(n)));
    const timestampByBlock = new Map(uniqueBlocks.map((n, i) => [n, Number(blocks[i]?.timestamp ?? 0)]));
    newEvents = raw.map((e) => ({ ...e, timestamp: timestampByBlock.get(e.blockNumber) ?? 0 }));
  }

  const merged = [...cachedEvents, ...newEvents];
  saveCipherGuessActivityCache({ lastBlock: currentBlock, events: merged });

  return merged;
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

/// Whether a wallet is on a listing's creator-invited allowlist - bypasses
/// the minScore gate entirely for that address.
export async function fetchIsParticipant(listingId, wallet) {
  const contract = getReadOnlyContract();
  return contract.isParticipant(listingId, wallet);
}

/// Invites additional wallets to bypass a listing's score gate. Creator-only,
/// only while the listing is still open.
export async function addParticipants(contract, listingId, participants) {
  const tx = await contract.addParticipants(listingId, participants);
  return tx.wait();
}

/// Cancels a still-open sealed bid before the listing's deadline, for a flat
/// CANCEL_FEE. Works for a bid placed directly or by an auto-bidding agent
/// signing as the same wallet - both are recorded under the real bidder's
/// address either way.
export async function cancelSealedBid(contract, listingId) {
  const tx = await contract.cancelSealedBid(listingId, { value: CANCEL_FEE_WEI });
  return tx.wait();
}

// --- Stealth listings ---
//
// A stealth listing's title/description/itemType/ipfsHash/minBid never sit in
// plaintext on-chain - they're ECIES-encrypted (see utils/sealedBid.js's
// encryptStealthDetails) into a single opaque blob only the TEE can decrypt.
// Fetching this state gives you the listing's existence/lifecycle
// (deadline/revealed/winner/winningAmount) but never its content - for that,
// see lib/tee/stealthProxy.js's fetchStealthDetails, an authenticated
// off-chain request straight to the TEE that never touches a transaction.

/// Fetches a stealth listing's on-chain (non-content) state: creator,
/// deadline, revealed/winner/winningAmount. deadline === 0n means "no such
/// listing". encryptedDetails is included as raw ciphertext - opaque without
/// the TEE, fetchStealthDetails is what actually decrypts it.
export async function fetchStealthListingOnChain(hashedId) {
  const contract = getReadOnlyContract();
  const listing = await contract.stealthListings(hashedId);
  return {
    creator: listing.creator,
    deadline: listing.deadline,
    revealed: listing.revealed,
    winner: listing.winner,
    winningAmount: listing.winningAmount,
    encryptedDetails: listing.encryptedDetails,
  };
}

/// Every bidder address that sealed a bid on a stealth listing.
export async function fetchStealthBidders(hashedId) {
  const contract = getReadOnlyContract();
  return contract.getStealthBidders(hashedId);
}

/// Whether a wallet is on a stealth listing's creator-invited allowlist - the
/// sole admission control for both bidding and viewing its decrypted details.
export async function fetchIsStealthParticipant(hashedId, wallet) {
  const contract = getReadOnlyContract();
  return contract.isStealthParticipant(hashedId, wallet);
}

/// Invites additional wallets to a stealth listing. Creator-only, only while
/// bidding is still open.
export async function addStealthParticipants(contract, hashedId, participants) {
  const tx = await contract.addStealthParticipants(hashedId, participants);
  return tx.wait();
}

/// Parses the hashedId a createStealthListing transaction produced from its
/// receipt logs - mined-tx return values aren't otherwise retrievable, so
/// this is the only reliable way to learn it (mirrors how NewBidDrawer parses
/// ListingCreated's listingId for regular listings).
export function parseStealthListingCreatedEvent(receipt, contract) {
  const parsed = receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((p) => p?.name === "StealthListingCreated");
  return parsed?.args?.hashedId ?? null;
}

// --- Cipher listings ---
//
// A skill-based challenge, not a bid: the creator's word list is public
// (browsable exactly like a standard listing), only guessing is invite-gated.
// Participants submit a sealed guess at how the TEE will reorder the words;
// at reveal, the TEE generates that reordering fresh, scores every guess, and
// publishes the winner's own arrangement plus the TEE's true arrangement -
// the frontend diffs the two itself, no match-count field travels on-chain.

/// Discovers every Cipher listing ever created on-chain. Same fix as
/// fetchAllListings: cipher listing IDs are also assigned sequentially
/// (`listingId = ++cipherListingCount`), so this is `cipherListingCount()` +
/// one `cipherListings(id)` + `getCipherWords(id)` pair per ID instead of a
/// CipherListingCreated event scan. Words live in a separate getter because
/// dynamic arrays inside a struct aren't included in the struct's own
/// auto-generated getter. Creation tx hash/block number aren't recoverable
/// without that event scan, so they're left null (same tradeoff as
/// fetchAllListings). Returns [{ listingId, creator, deadline, title,
/// description, itemType, ipfsHash, wordCount, words, txHash: null,
/// blockNumber: null }].
export async function fetchAllCipherListings() {
  const contract = getReadOnlyContract();
  const count = Number(await contract.cipherListingCount());
  if (count === 0) return [];

  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const raw = await Promise.all(
    ids.map(async (id) => {
      const [listing, words] = await Promise.all([contract.cipherListings(id), contract.getCipherWords(id)]);
      return { listing, words };
    })
  );

  return raw.map(({ listing, words }, i) => ({
    listingId: BigInt(ids[i]),
    creator: listing.creator,
    deadline: listing.deadline,
    title: listing.title,
    description: listing.description,
    itemType: listing.itemType,
    ipfsHash: listing.ipfsHash,
    wordCount: Number(listing.wordCount),
    words: [...words],
    txHash: null,
    blockNumber: null,
  }));
}

/// Fetches live on-chain state for a single Cipher listing: creator,
/// deadline, revealed/winner/wordCount, item metadata (title/description/
/// itemType/ipfsHash), plus the settlement tx hash (from the
/// CipherListingRevealed event log) once revealed. Mirrors fetchOnChainListing.
export async function fetchCipherListingOnChain(listingId) {
  const contract = getReadOnlyContract();
  const listing = await contract.cipherListings(listingId);

  const result = {
    creator: listing.creator,
    deadline: listing.deadline,
    revealed: listing.revealed,
    winner: listing.winner,
    wordCount: Number(listing.wordCount),
    title: listing.title,
    description: listing.description,
    itemType: listing.itemType,
    ipfsHash: listing.ipfsHash,
    txHash: null,
  };

  if (listing.revealed) {
    const provider = getReadOnlyProvider();
    const currentBlock = await provider.getBlockNumber();
    const filter = contract.filters.CipherListingRevealed(listingId);
    const event = await findLatestLogBackward(contract, filter, DEPLOY_BLOCK, currentBlock).catch(() => null);
    result.txHash = event?.transactionHash ?? null;
  }

  return result;
}

/// Every guesser address that sealed a guess on a Cipher listing.
export async function fetchCipherGuessers(listingId) {
  const contract = getReadOnlyContract();
  return contract.getCipherGuessers(listingId);
}

/// Whether a wallet is on a Cipher listing's creator-invited allowlist - the
/// sole admission control for guessing (the word list itself is already public).
export async function fetchIsCipherParticipant(listingId, wallet) {
  const contract = getReadOnlyContract();
  return contract.isCipherParticipant(listingId, wallet);
}

/// Invites additional wallets to guess on a Cipher listing. Creator-only,
/// only while the listing is still open.
export async function addCipherParticipants(contract, listingId, participants) {
  const tx = await contract.addCipherParticipants(listingId, participants);
  return tx.wait();
}

/// The winner's own submitted guess, public only after reveal - an array of
/// word-indices into the listing's public word list (words[arrangement[i]]
/// is the word at position i).
export async function fetchCipherWinnerArrangement(listingId) {
  const contract = getReadOnlyContract();
  const result = await contract.getCipherWinnerArrangement(listingId);
  return result.map((n) => Number(n));
}

/// The TEE's true arrangement, public only after reveal - same encoding as
/// fetchCipherWinnerArrangement. The frontend diffs the two to compute and
/// display the match count; no match-count field is ever stored on-chain.
export async function fetchCipherTrueArrangement(listingId) {
  const contract = getReadOnlyContract();
  const result = await contract.getCipherTrueArrangement(listingId);
  return result.map((n) => Number(n));
}
