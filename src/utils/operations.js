import { isRevealed, resolveWinner, formatRelativeTime } from "./bids";

export const OPERATION_STEPS = [
  "Wallet Signed",
  "Transaction Submitted",
  "Waiting for Relay",
  "Executing in TEE",
  "Attestation Verified",
];

// Maps a real on-chain bid status to how far the 5-step pipeline above has
// progressed. `current` is the index of the step still in progress
// (everything before it renders as complete); resolved statuses complete
// every step. Sealed bids sit in the TEE, held confidentially until the
// deadline reveals them - Won/Lost only exist once that reveal has run;
// Withdrawn means the bidder cancelled before ever reaching reveal.
const STEP_BY_STATUS = {
  Sealed: 3,
  Won: 6,
  Lost: 6,
  Withdrawn: 6,
};

export function getOperationProgress(operation) {
  return {
    current: STEP_BY_STATUS[operation.status] ?? 0,
    failed: false,
  };
}

export function finalStepLabel(status) {
  return status === "Withdrawn" ? "Bid Withdrawn" : "Bid Resolved";
}

/// Builds the Operations feed entirely from real on-chain data - no mock
/// data anywhere.
/// @param bids BidsContext's already-fetched listings (creator/deadline/
///   revealed/winner/winningAmount/participants) - see BidsContext.jsx.
/// @param activity fetchBidActivity()'s BidSealed/BidCancelled event log
///   (real tx hashes and block timestamps) - see contracts/VeilBidding.js.
///   Stealth listing bids are deliberately excluded from both inputs - see
///   fetchBidActivity's comment on why.
export function buildOperationsFeed(bids, activity) {
  const bidsById = new Map(bids.map((b) => [b.onChainListingId, b]));
  const sealedByKey = new Map(
    activity.filter((e) => e.kind === "Sealed").map((e) => [`${e.listingId}:${e.bidder.toLowerCase()}`, e])
  );

  // getBidders() (and so BidsContext's participants) only ever reflects
  // currently-active bids - cancelSealedBid removes the bidder from it
  // entirely, so a withdrawn bid has to be reconstructed from its
  // BidCancelled event instead of from `bids`.
  const bidOps = bids.flatMap((bid) => {
    const revealed = isRevealed(bid);
    const winner = revealed ? resolveWinner(bid) : null;

    return bid.participants.map((p) => {
      const sealedEvent = sealedByKey.get(`${bid.onChainListingId}:${p.wallet.toLowerCase()}`);

      let status = "Sealed";
      let amount = 0;
      if (revealed && winner) {
        const isWinner = p.wallet.toLowerCase() === winner.wallet.toLowerCase();
        status = isWinner ? "Won" : "Lost";
        // Losing amounts are never revealed by the TEE, on-chain or
        // otherwise - only the winner's amount is ever known here.
        if (isWinner) amount = winner.amount;
      }

      return {
        id: `bid-${bid.onChainListingId}-${p.wallet}`,
        type: "Bid",
        party: bid.title,
        wallet: p.wallet,
        amount,
        token: bid.token,
        status,
        time: sealedEvent ? formatRelativeTime(sealedEvent.timestamp * 1000) : "On-chain",
        txHash: sealedEvent?.txHash ?? null,
      };
    });
  });

  const withdrawnOps = activity
    .filter((e) => e.kind === "Cancelled")
    .map((e) => ({
      id: `bid-${e.listingId}-${e.bidder}-withdrawn`,
      type: "Bid",
      party: bidsById.get(e.listingId)?.title ?? `Listing #${e.listingId}`,
      wallet: e.bidder,
      amount: 0,
      token: "FLR",
      status: "Withdrawn",
      time: formatRelativeTime(e.timestamp * 1000),
      txHash: e.txHash,
    }));

  return [...bidOps, ...withdrawnOps];
}
