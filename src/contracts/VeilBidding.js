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
// Redeployed 2026-08-03 to add Cipher Listings (contracts aren't upgradeable,
// so adding new functions means a new address) - listings on the previous
// address (0xdF5C10261e99617912E7bB4aeEFab35a0Ecdd963) are no longer reachable
// from this app, though they still exist on-chain.
const DEFAULT_ADDRESS = "0x9A0b1c0209eCa8417dCecf417b44187398613531";
export const VEIL_BIDDING_ADDRESS = import.meta.env.VITE_VEILBIDDING_ADDRESS || DEFAULT_ADDRESS;

// Block the contract was deployed at - scopes event queries so we don't scan
// from genesis on every page load.
export const DEPLOY_BLOCK = Number(import.meta.env.VITE_VEILBIDDING_DEPLOY_BLOCK || 33594964);

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
// meaningful range means paging through in small chunks.
const LOG_CHUNK_SIZE = 25;
// Scoped by contract address + schema version so a redeploy (new address, or
// new fields on ListingCreated) never merges stale cached events with a
// different contract's/schema's data.
const LISTINGS_CACHE_KEY = `veilseal:listing-events-cache:v3:${VEIL_BIDDING_ADDRESS}`;

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

/// Discovers every listing ever created on-chain via ListingCreated events -
/// the source of truth for "which listings exist", since a listing created
/// from one browser/account must still be visible (and biddable) from any
/// other. The event carries the full item metadata (title/description/
/// itemType/ipfsHash/minBid), so no separate per-listing call or off-chain
/// index is needed to render the list. Caches results + last-synced block in
/// localStorage so repeat loads only scan new blocks, since the public RPC's
/// 30-block eth_getLogs cap makes a full historical scan expensive. Returns
/// [{ listingId, creator, deadline, title, description, itemType, ipfsHash,
/// minBid, txHash }], oldest first.
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
    title: event.args.title,
    description: event.args.description,
    itemType: event.args.itemType,
    ipfsHash: event.args.ipfsHash,
    minBid: event.args.minBid.toString(),
    minScore: event.args.minScore.toString(),
    inviteOnly: event.args.inviteOnly,
    txHash: event.transactionHash,
    blockNumber: event.blockNumber,
  }));

  const merged = [...cachedEvents, ...newEvents];
  saveListingsCache({ lastBlock: currentBlock, events: merged });

  return merged.map((e) => ({
    listingId: BigInt(e.listingId),
    creator: e.creator,
    deadline: BigInt(e.deadline),
    title: e.title,
    description: e.description,
    itemType: e.itemType,
    ipfsHash: e.ipfsHash,
    minBid: BigInt(e.minBid),
    minScore: BigInt(e.minScore ?? 0),
    inviteOnly: Boolean(e.inviteOnly),
    txHash: e.txHash,
    blockNumber: e.blockNumber,
  }));
}

/// Resolves the block timestamp (ms epoch) for each given block number,
/// deduped so a block referenced by several events only costs one RPC call.
/// Shared by fetchBidActivity and Operations' "listings I created" rows.
export async function resolveBlockTimestamps(blockNumbers) {
  const provider = getReadOnlyProvider();
  const uniqueBlocks = [...new Set(blockNumbers)];
  const blocks = await Promise.all(uniqueBlocks.map((n) => provider.getBlock(n)));
  return new Map(uniqueBlocks.map((n, i) => [n, Number(blocks[i]?.timestamp ?? 0) * 1000]));
}

// Scoped by contract address + schema version, same reasoning as
// LISTINGS_CACHE_KEY.
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

/// Discovers every sealed-bid activity event ever emitted for standard
/// listings - BidSealed (a bid was committed) and BidCancelled (withdrawn
/// before reveal) - each with a real tx hash and block timestamp. The
/// Operations page derives its feed from this plus the already-fetched
/// listings/participants state (see utils/operations.js) instead of mock
/// data. Cached and chunked the same way fetchAllListings is, for the same
/// reason (Coston2's public RPC caps eth_getLogs at 30 blocks per call).
///
/// Stealth listing activity is deliberately excluded - stealth listings are
/// meant to be undiscoverable without their hashedId, and surfacing "who
/// bid on what" in a globally-visible feed would defeat that even without
/// showing the listing's content.
export async function fetchBidActivity() {
  const contract = getReadOnlyContract();
  const provider = getReadOnlyProvider();
  const currentBlock = await provider.getBlockNumber();

  const cache = loadBidActivityCache();
  const fromBlock = cache && cache.lastBlock >= DEPLOY_BLOCK ? cache.lastBlock + 1 : DEPLOY_BLOCK;
  const cachedEvents = cache?.events ?? [];

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

// Scoped by contract address + schema version, same reasoning as
// LISTINGS_CACHE_KEY. v2: CipherListingCreated gained title/description/
// itemType/ipfsHash (the auctioned item's metadata).
const CIPHER_LISTINGS_CACHE_KEY = `veilseal:cipher-listing-events-cache:v2:${VEIL_BIDDING_ADDRESS}`;

function loadCipherListingsCache() {
  try {
    return JSON.parse(localStorage.getItem(CIPHER_LISTINGS_CACHE_KEY)) ?? null;
  } catch {
    return null;
  }
}

function saveCipherListingsCache(cache) {
  localStorage.setItem(CIPHER_LISTINGS_CACHE_KEY, JSON.stringify(cache));
}

/// Discovers every Cipher listing ever created on-chain via
/// CipherListingCreated events - mirrors fetchAllListings exactly, including
/// the chunked-scan-with-localStorage-cache pattern. The event carries the
/// full item metadata and word list, so no separate per-listing call is
/// needed to render a listing card. Returns [{ listingId, creator, deadline,
/// title, description, itemType, ipfsHash, wordCount, words, txHash,
/// blockNumber }], oldest first.
export async function fetchAllCipherListings() {
  const contract = getReadOnlyContract();
  const provider = getReadOnlyProvider();
  const currentBlock = await provider.getBlockNumber();

  const cache = loadCipherListingsCache();
  const fromBlock = cache && cache.lastBlock >= DEPLOY_BLOCK ? cache.lastBlock + 1 : DEPLOY_BLOCK;
  const cachedEvents = cache?.events ?? [];

  let newRaw = [];
  if (fromBlock <= currentBlock) {
    const filter = contract.filters.CipherListingCreated();
    newRaw = await queryLogsChunked(contract, filter, fromBlock, currentBlock);
  }

  const newEvents = newRaw.map((event) => ({
    listingId: event.args.listingId.toString(),
    creator: event.args.creator,
    deadline: event.args.deadline.toString(),
    title: event.args.title,
    description: event.args.description,
    itemType: event.args.itemType,
    ipfsHash: event.args.ipfsHash,
    wordCount: Number(event.args.wordCount),
    words: [...event.args.words],
    txHash: event.transactionHash,
    blockNumber: event.blockNumber,
  }));

  const merged = [...cachedEvents, ...newEvents];
  saveCipherListingsCache({ lastBlock: currentBlock, events: merged });

  return merged.map((e) => ({
    listingId: BigInt(e.listingId),
    creator: e.creator,
    deadline: BigInt(e.deadline),
    title: e.title,
    description: e.description,
    itemType: e.itemType,
    ipfsHash: e.ipfsHash,
    wordCount: e.wordCount,
    words: e.words,
    txHash: e.txHash,
    blockNumber: e.blockNumber,
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
