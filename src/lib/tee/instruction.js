// Ported from fce-weather-insurance/frontend/lib/tee/instruction.ts - parses
// the FCC instruction ID out of a transaction receipt so the frontend knows
// what to poll the extension proxy for.
import { id as topicId } from "ethers";

// keccak256 topic0 for the real FlareTeeManager's TeeInstructionsSent event.
export const TEE_INSTRUCTIONS_SENT_TOPIC = topicId(
  "TeeInstructionsSent(uint256,bytes32,uint32,(address,address,string)[],bytes32,bytes32,bytes,address[],uint64,address,uint256)"
);

/// Parses instructionId from TeeInstructionsSent's indexed topics alone
/// (topic[1]=extensionId, topic[2]=instructionId, topic[3]=rewardEpochId) -
/// no ABI needed since all three are `indexed`.
export function parseTeeInstructionsSentFromLog(log) {
  const { topics } = log;
  if (!topics || topics.length < 4 || topics[0] !== TEE_INSTRUCTIONS_SENT_TOPIC) return null;

  const instructionId = topics[2];
  if (!instructionId || instructionId.length !== 66) return null;

  return {
    extensionId: BigInt(topics[1] ?? 0),
    instructionId,
    rewardEpochId: Number(BigInt(topics[3] ?? 0)),
  };
}

export function parseInstructionIdFromReceipt(receipt) {
  for (const log of receipt.logs ?? []) {
    const parsed = parseTeeInstructionsSentFromLog(log);
    if (parsed) return parsed.instructionId;
  }

  // Fall back to our own RevealRequested(listingId, instructionId) event.
  for (const log of receipt.logs ?? []) {
    // RevealRequested(uint256 indexed listingId, bytes32 instructionId) -
    // instructionId is the sole non-indexed word in `data`.
    if (log.data && log.data.length === 66) {
      return log.data;
    }
  }
  return null;
}
