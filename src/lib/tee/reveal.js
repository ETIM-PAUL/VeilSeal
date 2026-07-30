// Orchestrates the real reveal flow against a VeilBidding contract that's
// actually registered with Flare's live FlareTeeManager (see
// fce-weather-insurance's InstructionSender pattern) — as opposed to
// src/utils/sealedBid.js + scripts/simulate-tee-settle.cjs, which drive our
// self-contained (no real registry) contract. Ported from
// fce-weather-insurance/frontend/lib/tee/private-buy.ts's
// requestAndRelayPrivateBuy, adapted for reveal instead of buy.
//
// Not wired into the UI yet — this targets the real-registry contract ABI
// (contracts/InstructionSender.sol in the fce-weather-insurance fork), which
// is a different submitRevealResult signature than our currently-deployed
// self-contained VeilBidding. Swap src/contracts/VeilBidding.js's ABI over
// once that contract is deployed and this becomes the live path.
import { fetchTeeInfo, pollActionResult, actionResultFields } from "./proxy";
import { parseInstructionIdFromReceipt } from "./instruction";

/// @param contract ethers Contract instance (VeilBidding, real-registry ABI)
/// @param listingId bigint
/// @param instructionFee bigint — wei value to forward to sendInstructions
/// @param onStep optional (label: string) => void progress callback
export async function requestAndRelayReveal(contract, listingId, instructionFee, onStep) {
  onStep?.("Requesting reveal on-chain…");
  const tx = await contract.requestReveal(listingId, { value: instructionFee });
  const receipt = await tx.wait();

  const instructionId = parseInstructionIdFromReceipt(receipt);
  if (!instructionId) {
    throw new Error("Could not parse instruction ID from requestReveal receipt");
  }

  onStep?.("Waiting for the TEE to decrypt sealed bids and pick a winner…");
  const actionResponse = await pollActionResult(instructionId);
  if (actionResponse.result.status !== 1) {
    throw new Error(actionResponse.result.log ?? "TEE reported failure");
  }

  const { data, actionId, submissionTag, status, signature } = actionResultFields(actionResponse);

  onStep?.("Relaying the TEE-signed result on-chain…");
  const relayTx = await contract.submitRevealResult(data, actionId, submissionTag, status, signature);
  const relayReceipt = await relayTx.wait();

  return { instructionId, actionResponse, requestReceipt: receipt, relayReceipt };
}

export { fetchTeeInfo };
