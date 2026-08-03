import { getBidStatus, isRevealed, resolveWinner, formatRelativeTime } from "./bids";

export const OPERATION_STEPS = [
  "Wallet Signed",
  "Transaction Submitted",
  "Waiting for Relay",
  "Executing in TEE",
  "Attestation Verified",
];

// Shared by the Operations page and Dashboard's stat cards, so "Pending"/
// "Resolved" mean exactly the same thing in both places.
export const PENDING_STATUSES = ["Sealed", "Open", "Awaiting Reveal"];
export const RESOLVED_STATUSES = ["Won", "Lost", "Withdrawn", "Revealed"];

// Maps a real on-chain status to how far the 5-step pipeline above has
// progressed. `current` is the index of the step still in progress
// (everything before it renders as complete); resolved statuses complete
// every step. Sealed bids sit in the TEE, held confidentially until the
// deadline reveals them - Won/Lost only exist once that reveal has run;
// Withdrawn means the bidder cancelled before ever reaching reveal. Open/
// Awaiting Reveal/Revealed are the same lifecycle from a listing's own
// perspective, for the "listings I created" rows.
const STEP_BY_STATUS = {
  Sealed: 3,
  Won: 6,
  Lost: 6,
  Withdrawn: 6,
  Open: 1,
  "Awaiting Reveal": 3,
  Revealed: 6,
};

export function getOperationProgress(operation) {
  return {
    current: STEP_BY_STATUS[operation.status] ?? 0,
    failed: false,
  };
}

export function finalStepLabel(status) {
  if (status === "Withdrawn") return "Bid Withdrawn";
  if (status === "Open" || status === "Awaiting Reveal" || status === "Revealed") return "Listing Revealed";
  return "Bid Resolved";
}

/// A single human-readable line per operation, for compact surfaces (the
/// Dashboard's activity feed) that don't have room for separate type/party/
/// status columns the way the Operations table does.
export function activityTitle(op) {
  if (op.type === "Listing") {
    if (op.status === "Open") return `Listing "${op.party}" opened for bidding`;
    if (op.status === "Awaiting Reveal") return `Listing "${op.party}" awaiting reveal`;
    return `Listing "${op.party}" revealed`;
  }
  if (op.status === "Won") return `Won "${op.party}"`;
  if (op.status === "Lost") return `Lost "${op.party}"`;
  if (op.status === "Withdrawn") return `Withdrew bid on "${op.party}"`;
  return `Sealed bid on "${op.party}"`;
}

/// Filters operations down to the current calendar month (local time) -
/// used by Dashboard's "Total Operations" card, which is meant as an
/// activity-volume metric ("how much has happened lately"), not an all-time
/// count. Operations with no resolved timestamp (timestamp: 0, shown as
/// "On-chain" rather than a relative time) are excluded rather than guessed
/// at, since we genuinely don't know when they happened.
export function operationsThisMonth(feed) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return feed.filter((op) => op.timestamp >= startOfMonth);
}

/// Builds the Operations feed from real on-chain data - no mock data
/// anywhere. Bid activity (Sealed/Won/Lost/Withdrawn) is a global feed
/// across every bidder, since it's all public on-chain information anyway
/// (only the sealed *amount* is ever confidential). The "Listing" rows are
/// the one part scoped to a specific wallet - listings the connected wallet
/// itself created - since "created by me" only means anything relative to
/// whoever's connected. Returned newest-first.
///
/// Stealth listings are deliberately excluded entirely: their content stays
/// encrypted and undiscoverable by design, so neither their bids nor their
/// creation ever appear here, even for the wallet that created them - only
/// the hashed ID (shared out-of-band) can surface that.
/// @param bids BidsContext's already-fetched listings (creator/deadline/
///   revealed/winner/winningAmount/participants) - see BidsContext.jsx.
/// @param activity fetchBidActivity()'s BidSealed/BidCancelled event log
///   (real tx hashes and block timestamps) - see contracts/VeilBidding.js.
/// @param wallet the connected wallet address, or null/undefined - only
///   affects the "Listing" rows; bid activity stays global either way.
/// @param listingTimestamps Map<listingId, timestampMs> for the connected
///   wallet's own listings (see resolveBlockTimestamps) - optional, falls
///   back to "On-chain" (and sorts as oldest) per row if not provided.
export function buildOperationsFeed(bids, activity, wallet, listingTimestamps = new Map()) {
  const normalizedWallet = wallet?.toLowerCase();

  const bidsById = new Map(bids.map((b) => [b.onChainListingId, b]));
  const sealedByKey = new Map(
    activity.filter((e) => e.kind === "Sealed").map((e) => [`${e.listingId}:${e.bidder.toLowerCase()}`, e])
  );

  const bidOps = bids.flatMap((bid) => {
    const revealed = isRevealed(bid);
    const winner = revealed ? resolveWinner(bid) : null;

    return bid.participants.map((p) => {
      const sealedEvent = sealedByKey.get(`${bid.onChainListingId}:${p.wallet.toLowerCase()}`);
      const timestamp = sealedEvent ? sealedEvent.timestamp * 1000 : 0;

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
        time: sealedEvent ? formatRelativeTime(timestamp) : "On-chain",
        timestamp,
        txHash: sealedEvent?.txHash ?? null,
      };
    });
  });

  // getBidders() (and so BidsContext's participants) only ever reflects
  // currently-active bids - cancelSealedBid removes the bidder from it
  // entirely, so a withdrawn bid has to be reconstructed from its
  // BidCancelled event instead of from `bids`.
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
      timestamp: e.timestamp * 1000,
      txHash: e.txHash,
    }));

  const listingOps = normalizedWallet
    ? bids
        .filter((bid) => bid.creator?.toLowerCase() === normalizedWallet)
        .map((bid) => {
          const revealed = isRevealed(bid);
          const winner = revealed ? resolveWinner(bid) : null;
          const status = getBidStatus(bid) === "Open" ? "Open" : revealed ? "Revealed" : "Awaiting Reveal";
          const timestampMs = listingTimestamps.get(bid.onChainListingId);

          return {
            id: `listing-${bid.onChainListingId}`,
            type: "Listing",
            party: bid.title,
            wallet: bid.creator,
            amount: winner ? winner.amount : bid.minBid,
            token: bid.token,
            status,
            time: timestampMs ? formatRelativeTime(timestampMs) : "On-chain",
            timestamp: timestampMs ?? 0,
            txHash: bid.txHash ?? null,
          };
        })
    : [];

  return [...bidOps, ...withdrawnOps, ...listingOps].sort((a, b) => b.timestamp - a.timestamp);
}
