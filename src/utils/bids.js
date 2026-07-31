import { LuImage, LuVideo, LuMusic, LuFile } from "react-icons/lu";

import { fromChainAmount } from "./sealedBid";

export const ITEM_TYPES = [
  { value: "image", label: "Image", icon: LuImage },
  { value: "video", label: "Video", icon: LuVideo },
  { value: "audio", label: "Audio", icon: LuMusic },
  { value: "file", label: "File", icon: LuFile },
];

export const BID_TOKENS = ["FLR", "USDC", "ETH"];

export function itemTypeMeta(type) {
  return ITEM_TYPES.find((item) => item.value === type) ?? ITEM_TYPES[3];
}

export function getBidStatus(bid) {
  return Date.now() >= new Date(bid.deadline).getTime() ? "Closed" : "Open";
}

export function getWinner(bid) {
  const live = bid.participants.filter((p) => !p.withdrawn);
  if (live.length === 0) return null;
  return live.reduce((best, p) => (p.amount > best.amount ? p : best), live[0]);
}

/// Whether a listing has an authoritative winner yet. On-chain listings only
/// have sealed (amount-less) bids until the TEE actually reveals them — the
/// bidding deadline passing is not the same as a reveal having happened, so
/// this checks the contract's own `revealed` flag rather than the deadline.
/// `onChainOverride` lets callers pass fresher just-fetched on-chain data
/// (e.g. right after submitting a reveal) instead of the possibly-stale
/// copy cached on `bid` itself; both shapes carry the same revealed/winner/
/// winningAmount fields (see fetchOnChainListing).
export function isRevealed(bid, onChainOverride) {
  if (!bid.onChainListingId) return getBidStatus(bid) === "Closed";
  return Boolean((onChainOverride ?? bid)?.revealed);
}

/// The revealed winner, or null if the listing isn't revealed yet. For
/// on-chain listings this comes from the contract's TEE-attested
/// winner/winningAmount (matched back to the bidder's participant entry for
/// its `mine`/`id` fields) — never from comparing sealed (amount-less) bids,
/// since only the TEE ever learns the real amounts.
export function resolveWinner(bid, onChainOverride) {
  if (!bid.onChainListingId) {
    return getBidStatus(bid) === "Closed" ? getWinner(bid) : null;
  }

  const chain = onChainOverride ?? bid;
  if (!chain?.revealed || !chain.winner) return null;

  const participant = bid.participants.find(
    (p) => p.wallet.toLowerCase() === chain.winner.toLowerCase()
  );

  return {
    id: participant?.id ?? chain.winner,
    wallet: chain.winner,
    mine: participant?.mine ?? false,
    amount: fromChainAmount(chain.winningAmount),
  };
}

export function formatCountdown(deadline) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Deadline passed";

  const mins = Math.floor(diff / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const remMins = mins % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${remMins}m left`;
  return `${remMins}m left`;
}

export function formatDeadline(deadline) {
  return new Date(deadline).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
