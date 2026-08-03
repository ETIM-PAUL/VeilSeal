import { useCallback, useEffect, useMemo, useState } from "react";

import { useWallet } from "./useWallet";
import {
  fetchAllCipherListings,
  fetchCipherGuessers,
  fetchCipherListingOnChain,
  isContractConfigured,
} from "../contracts/VeilBidding";
import { CipherListingsContext } from "./cipher-listings-context";

// Lives above the router (see App.jsx) so on-chain Cipher listings are
// fetched once and kept around across route changes - mirrors BidsProvider
// exactly. Only an explicit refresh() call or the connected wallet changing
// triggers a re-fetch.
export function CipherListingsProvider({ children }) {
  const { address } = useWallet();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(() => isContractConfigured());
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!isContractConfigured()) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cipherListings = await fetchAllCipherListings();

        const merged = await Promise.all(
          cipherListings.map(async (listing) => {
            const listingId = listing.listingId.toString();
            const [guessers, onChainListing] = await Promise.all([
              fetchCipherGuessers(listing.listingId).catch(() => []),
              fetchCipherListingOnChain(listing.listingId).catch(() => null),
            ]);

            return {
              id: `cipher-${listingId}`,
              onChainListingId: listingId,
              creator: listing.creator,
              deadline: new Date(Number(listing.deadline) * 1000).toISOString(),
              txHash: listing.txHash,
              blockNumber: listing.blockNumber,
              wordCount: listing.wordCount,
              words: listing.words,
              guesserCount: guessers.length,
              revealed: onChainListing?.revealed ?? false,
              winner: onChainListing?.winner ?? null,
            };
          })
        );

        if (cancelled) return;
        merged.reverse(); // newest listing first
        setListings(merged);
      } catch (err) {
        if (!cancelled) setError(err?.message ?? "Failed to fetch on-chain cipher listings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshTick, address]);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  // Shared by NewCipherListingDrawer so a freshly-created listing shows up
  // immediately without waiting on the next on-chain fetch, then gets
  // replaced with authoritative state on the refresh() below.
  const createCipherListing = useCallback(
    (data) => {
      const onChainListingId = data.onChainListingId;
      if (!onChainListingId) return;

      setListings((prev) => [{ id: `cipher-${onChainListingId}`, guesserCount: 0, ...data }, ...prev]);
      refresh();
    },
    [refresh]
  );

  const value = useMemo(
    () => ({ listings, setListings, loading, error, refresh, createCipherListing }),
    [listings, loading, error, refresh, createCipherListing]
  );

  return <CipherListingsContext.Provider value={value}>{children}</CipherListingsContext.Provider>;
}
