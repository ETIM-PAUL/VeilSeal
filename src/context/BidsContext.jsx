import { useCallback, useEffect, useMemo, useState } from "react";

import { fromChainAmount } from "../utils/sealedBid";
import { useWallet } from "./useWallet";
import { fetchAllListings, fetchBidders, fetchOnChainListing, isContractConfigured } from "../contracts/VeilBidding";
import { BidsContext } from "./bids-context";

// Lives above the router (see App.jsx) so on-chain listings are fetched once
// and kept around across route changes — visiting /bids, navigating away,
// and coming back no longer re-fetches or re-flashes the loading skeleton.
// Only an explicit refresh() call (the Refresh button) or the connected
// wallet changing triggers a re-fetch.
export function BidsProvider({ children }) {
  const { address } = useWallet();

  // Bids shown here are exclusively what's discovered on-chain — no seed/mock
  // listings. See the fetch effect below.
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(() => isContractConfigured());
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Discover every listing that exists on-chain (created by any account, in
  // any browser) — this is what makes a listing created from one account
  // visible and biddable from another.
  useEffect(() => {
    if (!isContractConfigured()) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const listings = await fetchAllListings();

        const merged = await Promise.all(
          listings.map(async (listing) => {
            const listingId = listing.listingId.toString();
            const [bidders, onChainListing] = await Promise.all([
              fetchBidders(listing.listingId).catch(() => []),
              fetchOnChainListing(listing.listingId).catch(() => null),
            ]);

            const participants = bidders.map((wallet, index) => ({
              id: index + 1,
              wallet,
              amount: 0,
              token: "FLR",
              submittedAt: "On-chain",
              mine: address ? wallet.toLowerCase() === address.toLowerCase() : false,
              withdrawn: false,
            }));

            return {
              id: `chain-${listingId}`,
              onChainListingId: listingId,
              creator: listing.creator,
              deadline: new Date(Number(listing.deadline) * 1000).toISOString(),
              txHash: listing.txHash,
              title: listing.title,
              description: listing.description,
              itemType: listing.itemType,
              ipfsHash: listing.ipfsHash,
              minBid: fromChainAmount(listing.minBid),
              minScore: listing.minScore ?? 0n,
              inviteOnly: Boolean(listing.inviteOnly),
              token: "FLR",
              participants,
              revealed: onChainListing?.revealed ?? false,
              winner: onChainListing?.winner ?? null,
              winningAmount: onChainListing?.winningAmount ?? null,
            };
          })
        );

        if (cancelled) return;
        merged.reverse(); // newest listing first
        setBids(merged);
      } catch (err) {
        if (!cancelled) setError(err?.message ?? "Failed to fetch on-chain listings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshTick, address]);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  const value = useMemo(
    () => ({ bids, setBids, loading, error, refresh }),
    [bids, loading, error, refresh]
  );

  return <BidsContext.Provider value={value}>{children}</BidsContext.Provider>;
}
