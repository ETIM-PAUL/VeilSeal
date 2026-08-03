import { useEffect, useMemo, useState } from "react";

import { useBids } from "../context/useBids";
import { useWallet } from "../context/useWallet";
import { fetchBidActivity, resolveBlockTimestamps } from "../contracts/VeilBidding";
import { buildOperationsFeed } from "../utils/operations";

/// Shared by the Operations page and Dashboard's activity feed/stat cards,
/// so both read the exact same real on-chain data instead of each computing
/// their own version - see buildOperationsFeed for what's actually in the
/// feed (global bid activity + the connected wallet's own listings,
/// standard listings only).
export function useOperationsFeed() {
  const { address } = useWallet();
  const { bids, loading: bidsLoading } = useBids();
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [listingTimestamps, setListingTimestamps] = useState(new Map());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setActivityLoading(true);
      try {
        const events = await fetchBidActivity();
        if (!cancelled) setActivity(events);
      } catch {
        if (!cancelled) setActivity([]);
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Only resolves block timestamps for the connected wallet's own listings
  // (a handful at most), not the whole marketplace - those are the only
  // rows here that need a real creation time.
  useEffect(() => {
    let cancelled = false;

    // Deferred a tick so every state update below happens post-await, never
    // synchronously within the effect body.
    Promise.resolve().then(async () => {
      if (cancelled) return;

      if (!address) {
        setListingTimestamps(new Map());
        return;
      }

      const mine = bids.filter(
        (b) => b.creator?.toLowerCase() === address.toLowerCase() && b.blockNumber != null
      );
      if (mine.length === 0) {
        setListingTimestamps(new Map());
        return;
      }
      try {
        const byBlock = await resolveBlockTimestamps(mine.map((b) => b.blockNumber));
        if (!cancelled) {
          setListingTimestamps(new Map(mine.map((b) => [b.onChainListingId, byBlock.get(b.blockNumber)])));
        }
      } catch {
        if (!cancelled) setListingTimestamps(new Map());
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bids, address]);

  const loading = bidsLoading || activityLoading;
  const feed = useMemo(
    () => buildOperationsFeed(bids, activity, address, listingTimestamps),
    [bids, activity, address, listingTimestamps]
  );

  return { feed, loading };
}
