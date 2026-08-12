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

export function finalStepLabel(status, type) {
  if (status === "Withdrawn") return "Bid Withdrawn";
  if (status === "Open" || status === "Awaiting Reveal" || status === "Revealed") return "Listing Revealed";
  return type === "Guess" ? "Guess Resolved" : "Bid Resolved";
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
  if (op.type === "Cipher Listing") {
    if (op.status === "Open") return `Cipher listing "${op.party}" opened for guessing`;
    if (op.status === "Awaiting Reveal") return `Cipher listing "${op.party}" awaiting reveal`;
    return `Cipher listing "${op.party}" revealed`;
  }
  if (op.type === "Guess") {
    if (op.status === "Won") return `Won cipher "${op.party}"`;
    if (op.status === "Lost") return `Lost cipher "${op.party}"`;
    return `Sealed guess on cipher "${op.party}"`;
  }
  if (op.status === "Won") return `Won "${op.party}"`;
  if (op.status === "Lost") return `Lost "${op.party}"`;
  if (op.status === "Withdrawn") return `Withdrew bid on "${op.party}"`;
  return `Sealed bid on "${op.party}"`;
}

/// Builds the standard-listings half of the Operations feed from real
/// on-chain data - no mock data anywhere. Every row is scoped to the
/// connected wallet: bids/withdrawals it placed, and listings it created
/// ("created by me" only means anything relative to whoever's connected, and
/// likewise a bid is only "yours" if your wallet placed it). With no wallet
/// connected, every part of the feed is empty - there's no "whose" to scope
/// it to. Returned newest-first. Cipher listings are the other on-chain-
/// discoverable listing type - see buildCipherOperationsFeed just below;
/// callers (useOperationsFeed) merge both into one feed.
///
/// Stealth listings are deliberately excluded entirely: their content stays
/// encrypted and undiscoverable by design, so neither their bids nor their
/// creation ever appear here, even for the wallet that created them - only
/// the hashed ID (shared out-of-band) can surface that.
/// @param bids BidsContext's already-fetched listings (creator/deadline/
///   revealed/winner/winningAmount/participants) - see BidsContext.jsx.
/// @param activity fetchBidActivity()'s BidSealed/BidCancelled event log
///   (real tx hashes and block timestamps) - see contracts/VeilBidding.js.
/// @param wallet the connected wallet address, or null/undefined.
/// @param listingTimestamps Map<listingId, timestampMs> for the connected
///   wallet's own listings - optional, falls back to "On-chain" (and sorts
///   as oldest) per row if not provided. Nothing currently populates this
///   (fetchAllListings gets listings via listingCount()+listings(id) view
///   calls rather than a ListingCreated event scan, so there's no cheap
///   source for a real creation timestamp) - kept as a parameter rather than
///   removed since it's a straightforward re-add if that ever changes.
export function buildOperationsFeed(bids, activity, wallet, listingTimestamps = new Map()) {
  const normalizedWallet = wallet?.toLowerCase();

  const bidsById = new Map(bids.map((b) => [b.onChainListingId, b]));
  const sealedByKey = new Map(
    activity.filter((e) => e.kind === "Sealed").map((e) => [`${e.listingId}:${e.bidder.toLowerCase()}`, e])
  );

  const bidOps = normalizedWallet
    ? bids.flatMap((bid) => {
        const revealed = isRevealed(bid);
        const winner = revealed ? resolveWinner(bid) : null;

        return bid.participants
          .filter((p) => p.wallet.toLowerCase() === normalizedWallet)
          .map((p) => {
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
      })
    : [];

  // getBidders() (and so BidsContext's participants) only ever reflects
  // currently-active bids - cancelSealedBid removes the bidder from it
  // entirely, so a withdrawn bid has to be reconstructed from its
  // BidCancelled event instead of from `bids`.
  const withdrawnOps = normalizedWallet
    ? activity
        .filter((e) => e.kind === "Cancelled" && e.bidder.toLowerCase() === normalizedWallet)
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
        }))
    : [];

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

/// The Cipher Listings half of the Operations feed - mirrors
/// buildOperationsFeed's shape and reasoning (see its comment) so both
/// merge into a single feed with rows that render identically. Every row is
/// scoped to the connected wallet, same as the standard half. Two
/// differences from standard bids: a cipher guess has no cancel/withdraw
/// path (submitCipherGuess has no cancelSealedBid counterpart), so there's
/// no "Withdrawn" row kind here; and there's no bid amount at all - a
/// cipher listing's prize is the item itself, not a highest-bid auction -
/// so guessOps/listingOps always report amount 0.
///
/// Unlike buildOperationsFeed's bidOps (which reads live participants off
/// `bids`, since a withdrawn bid is removed from that list entirely), guess
/// rows are built directly from `cipherActivity` - every CipherGuessSealed
/// event is still a live guess, so there's nothing to reconcile against a
/// separate "current guessers" list.
/// @param cipherListings CipherListingsContext's already-fetched listings.
/// @param cipherActivity fetchCipherGuessActivity()'s CipherGuessSealed
///   event log - see contracts/VeilBidding.js.
/// @param wallet the connected wallet address, or null/undefined.
/// @param listingTimestamps Map<listingId, timestampMs> for the connected
///   wallet's own cipher listings - optional, falls back to "On-chain" (and
///   sorts as oldest) per row if not provided.
export function buildCipherOperationsFeed(cipherListings, cipherActivity, wallet, listingTimestamps = new Map()) {
  const normalizedWallet = wallet?.toLowerCase();
  const listingsById = new Map(cipherListings.map((l) => [l.onChainListingId, l]));

  const guessOps = normalizedWallet
    ? cipherActivity
        .filter((e) => e.guesser.toLowerCase() === normalizedWallet)
        .map((e) => {
          const listing = listingsById.get(e.listingId);
          const revealed = Boolean(listing?.revealed);
          const winner = revealed ? listing?.winner : null;

          let status = "Sealed";
          if (revealed && winner) {
            status = e.guesser.toLowerCase() === winner.toLowerCase() ? "Won" : "Lost";
          }

          return {
            id: `guess-${e.listingId}-${e.guesser}`,
            type: "Guess",
            party: listing?.title ?? `Cipher Listing #${e.listingId}`,
            wallet: e.guesser,
            amount: 0,
            token: "-",
            status,
            time: formatRelativeTime(e.timestamp * 1000),
            timestamp: e.timestamp * 1000,
            txHash: e.txHash,
          };
        })
    : [];

  const listingOps = normalizedWallet
    ? cipherListings
        .filter((listing) => listing.creator?.toLowerCase() === normalizedWallet)
        .map((listing) => {
          const revealed = Boolean(listing.revealed);
          const status = getBidStatus(listing) === "Open" ? "Open" : revealed ? "Revealed" : "Awaiting Reveal";
          const timestampMs = listingTimestamps.get(listing.onChainListingId);

          return {
            id: `cipher-listing-${listing.onChainListingId}`,
            type: "Cipher Listing",
            party: listing.title,
            wallet: listing.creator,
            amount: 0,
            token: "-",
            status,
            time: timestampMs ? formatRelativeTime(timestampMs) : "On-chain",
            timestamp: timestampMs ?? 0,
            txHash: listing.txHash ?? null,
          };
        })
    : [];

  return [...guessOps, ...listingOps].sort((a, b) => b.timestamp - a.timestamp);
}
