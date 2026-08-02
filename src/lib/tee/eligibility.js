// Orchestrates the SCORE eligibility check: requests a private TEE-computed
// check of both the wallet's signal score AND the sealed bid's amount
// against the listing's minScore/minBid in one round-trip, polls the proxy
// for the signed result, and returns it shaped for submitSealedBid's
// _attestation param. Unlike reveal, there's no separate relay transaction -
// the contract verifies the attestation inline inside submitSealedBid itself.
// If either check fails, the TEE reports failure with a message identifying
// which one - see pollActionResult's status/log below.
import { fetchTeeInfo, pollActionResult, actionResultFields } from "./proxy";
import { parseInstructionIdFromReceipt } from "./instruction";

/// @param contract ethers Contract instance (VeilBidding)
/// @param listingId bigint
/// @param termsCommitment bytes32 hex string - binds this attestation to the
///   specific bid amount being sealed, so it can't be replayed against a
///   different one
/// @param encryptedTerms bytes hex string - the same ciphertext about to be
///   sealed, so the TEE can decrypt it here to check the amount
/// @param instructionFee bigint - wei value to forward to sendInstructions
/// @param onStep optional (label: string) => void progress callback
/// @returns { attestation, eligible } - attestation is ready to pass into
///   contract.submitSealedBid(..., attestation); eligible is always true
///   here, since a failing check throws before this returns (see below).
export async function requestEligibilityAttestation(
  contract,
  listingId,
  termsCommitment,
  encryptedTerms,
  instructionFee,
  onStep
) {
  onStep?.("Requesting a private eligibility check…");
  const tx = await contract.requestScoreCheck(listingId, termsCommitment, encryptedTerms, { value: instructionFee });
  const receipt = await tx.wait();

  const instructionId = parseInstructionIdFromReceipt(receipt);
  if (!instructionId) {
    throw new Error("Could not parse instruction ID from requestScoreCheck receipt");
  }

  onStep?.("Waiting for the TEE to check your score and bid amount…");
  const actionResponse = await pollActionResult(instructionId);
  if (actionResponse.result.status !== 1) {
    // The Go handler checks score first, then amount, and returns a specific
    // message for whichever fails - e.g. "wallet score below required
    // threshold" or "bid amount below listing minimum".
    throw new Error(actionResponse.result.log ?? "TEE reported failure");
  }

  const attestation = actionResultFields(actionResponse);

  // abi.encode(uint256 listingId, address bidder, bytes32 termsCommitment,
  // bool eligible) - eligible is the sole boolean, always the last 32 bytes
  // regardless of how many fields precede it.
  const eligible = BigInt(`0x${attestation.data.slice(-64)}`) !== 0n;

  return { attestation, eligible, actionResponse };
}

/// Requests a private, informational read of the connected wallet's own
/// signal score - no listing, no threshold, nothing ever posted on-chain.
/// @param contract ethers Contract instance (VeilBidding)
/// @param instructionFee bigint - wei value to forward to sendInstructions
/// @param onStep optional (label: string) => void progress callback
/// @returns number - the wallet's current 0-100 signal score
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
  // abi.encode(address wallet, uint256 score) - score is the second 32-byte word.
  const score = Number(BigInt(`0x${data.slice(-64)}`));

  return score;
}

export { fetchTeeInfo };
