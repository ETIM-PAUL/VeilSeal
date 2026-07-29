import { treasuries, treasuryContributions } from "../data/mockData";
import { transfers } from "../data/transfers";
import { bids } from "../data/bids";
import { getBidStatus, getWinner } from "./bids";

export const OPERATION_STEPS = [
  "Wallet Signed",
  "Transaction Submitted",
  "Waiting for Relay",
  "Executing in TEE",
  "Attestation Verified",
];

// Maps a mock status to how far the 5-step pipeline above has progressed.
// `current` is the index of the step still in progress (everything before
// it renders as complete); Settled operations complete every step.
const STEP_BY_STATUS = {
  Queued: 2,
  Relayed: 3,
  Executing: 3,
  Attested: 5,
  Settled: 6,
  Failed: 3,
  // Sealed bids sit in TEE, held confidentially until the deadline reveals
  // them — the other three outcomes only exist once that reveal has run.
  Sealed: 3,
  Won: 6,
  Lost: 6,
  Withdrawn: 6,
};

export function getOperationProgress(operation) {
  return {
    current: STEP_BY_STATUS[operation.status] ?? 0,
    failed: operation.status === "Failed",
  };
}

export function finalStepLabel(type) {
  if (type === "Transfer") return "Transfer Completed";
  if (type === "Bid") return "Bid Resolved";
  return "Treasury Updated";
}

function mockTxHash() {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const segment = (len) => Array.from({ length: len }, hex).join("");
  return `0x${segment(4)}...${segment(4)}`;
}

export function buildOperationsFeed() {
  const contributionOps = Object.entries(treasuryContributions).flatMap(([treasuryId, items]) => {
    const treasuryName = treasuries.find((t) => t.id === treasuryId)?.name ?? treasuryId;

    return items.map((item) => ({
      id: `contribution-${treasuryId}-${item.id}`,
      type: "Contribution",
      party: treasuryName,
      wallet: item.wallet,
      amount: item.amount,
      token: item.token,
      status: item.status,
      time: item.time,
      txHash: item.txHash,
    }));
  });

  const transferOps = transfers.map((item) => ({
    id: `transfer-${item.id}`,
    type: "Transfer",
    party: item.recipient,
    wallet: item.recipient,
    amount: item.amount,
    token: item.token,
    status: item.status,
    time: item.createdAt,
    txHash: item.txHash,
  }));

  const bidOps = bids.flatMap((bid) => {
    const bidStatus = getBidStatus(bid);
    const winner = bidStatus === "Closed" ? getWinner(bid) : null;

    return bid.participants.map((p) => {
      let status = "Sealed";
      if (bidStatus === "Closed") {
        if (p.withdrawn) status = "Withdrawn";
        else if (winner && p.id === winner.id && p.wallet === winner.wallet) status = "Won";
        else status = "Lost";
      }

      return {
        id: `bid-${bid.id}-${p.id}`,
        type: "Bid",
        party: bid.title,
        wallet: p.wallet,
        amount: p.amount,
        token: bid.token,
        status,
        time: p.submittedAt,
        txHash: mockTxHash(),
      };
    });
  });

  return [...contributionOps, ...transferOps, ...bidOps];
}
