// Orchestrates the SCORE eligibility check: requests a private TEE-computed
// wallet score check against one listing's minScore, polls the proxy for the
// signed result, and returns it shaped for submitSealedBid's _attestation
// param. Unlike reveal, there's no separate relay transaction — the contract
// verifies the attestation inline inside submitSealedBid itself.
import { fetchTeeInfo, pollActionResult, actionResultFields } from "./proxy";
import { parseInstructionIdFromReceipt } from "./instruction";

/// @param contract ethers Contract instance (VeilBidding)
/// @param listingId bigint
/// @param instructionFee bigint — wei value to forward to sendInstructions
/// @param onStep optional (label: string) => void progress callback
/// @returns { attestation, eligible } — attestation is ready to pass into
///   contract.submitSealedBid(..., attestation); eligible is decoded for UI
///   feedback before the bidder commits to sealing anything.
export async function requestEligibilityAttestation(contract, listingId, instructionFee, onStep) {
  onStep?.("Requesting a private eligibility check…");
  const tx = await contract.requestScoreCheck(listingId, { value: instructionFee });
  const receipt = await tx.wait();

  const instructionId = parseInstructionIdFromReceipt(receipt);
  if (!instructionId) {
    throw new Error("Could not parse instruction ID from requestScoreCheck receipt");
  }

  onStep?.("Waiting for the TEE to check your wallet's signal score…");
  const actionResponse = await pollActionResult(instructionId);
  if (actionResponse.result.status !== 1) {
    throw new Error(actionResponse.result.log ?? "TEE reported failure");
  }

  const attestation = actionResultFields(actionResponse);

  // abi.encode(uint256 listingId, address bidder, bool eligible) — eligible
  // is the sole non-address, non-uint256 word: the last 32 bytes.
  const eligible = BigInt(`0x${attestation.data.slice(-64)}`) !== 0n;

  return { attestation, eligible, actionResponse };
}

/// Requests a private, informational read of the connected wallet's own
/// signal score — no listing, no threshold, nothing ever posted on-chain.
/// @param contract ethers Contract instance (VeilBidding)
/// @param instructionFee bigint — wei value to forward to sendInstructions
/// @param onStep optional (label: string) => void progress callback
/// @returns number — the wallet's current 0-100 signal score
export async function requestMyScore(contract, instructionFee, onStep) {
  onStep?.("Requesting your signal score…");
  const tx = await contract.requestMyScore({ value: instructionFee });
  const receipt = await tx.wait();

  const instructionId = parseInstructionIdFromReceipt(receipt);
  if (!instructionId) {
    throw new Error("Could not parse instruction ID from requestMyScore receipt");
  }

  onStep?.("Waiting for the TEE to compute your score…");
  const actionResponse = await pollActionResult(instructionId);
  if (actionResponse.result.status !== 1) {
    throw new Error(actionResponse.result.log ?? "TEE reported failure");
  }

  const { data } = actionResultFields(actionResponse);
  // abi.encode(address wallet, uint256 score) — score is the second 32-byte word.
  const score = Number(BigInt(`0x${data.slice(-64)}`));

  return score;
}

export { fetchTeeInfo };
