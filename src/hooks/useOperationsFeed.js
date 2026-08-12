import { useEffect, useMemo, useState } from "react";

import { useBids } from "../context/useBids";
import { useCipherListings } from "../context/useCipherListings";
import { useWallet } from "../context/useWallet";
import { fetchBidActivity, fetchCipherGuessActivity } from "../contracts/VeilBidding";
import { buildOperationsFeed, buildCipherOperationsFeed } from "../utils/operations";

/// Shared by the Operations page and Dashboard's activity feed/stat cards,
/// so both read the exact same real on-chain data instead of each computing
/// their own version. Merges two on-chain-discoverable listing types -
/// standard (buildOperationsFeed) and Cipher (buildCipherOperationsFeed) -
/// into one feed; see those functions for what's actually in each half.
/// Stealth listings are excluded from both by design (see
/// buildOperationsFeed's comment).
///
/// Neither half passes real creation timestamps for "my own listings" rows
/// (both fetchAllListings and fetchAllCipherListings read listings via
/// listingCount()+listings(id)/cipherListings(id) view calls now rather than
/// scanning ListingCreated/CipherListingCreated events, so blockNumber is
/// always null - see contracts/VeilBidding.js). Those rows fall back to
/// buildOperationsFeed/buildCipherOperationsFeed's "On-chain" display case.
export function useOperationsFeed() {
  const { address } = useWallet();
  const { bids, loading: bidsLoading } = useBids();
  const { listings: cipherListings, loading: cipherListingsLoading } = useCipherListings();
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [cipherActivity, setCipherActivity] = useState([]);
  const [cipherActivityLoading, setCipherActivityLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setCipherActivityLoading(true);
      try {
        const events = await fetchCipherGuessActivity();
        if (!cancelled) setCipherActivity(events);
      } catch {
        if (!cancelled) setCipherActivity([]);
      } finally {
        if (!cancelled) setCipherActivityLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loading = bidsLoading || activityLoading || cipherListingsLoading || cipherActivityLoading;
  const feed = useMemo(() => {
    const standard = buildOperationsFeed(bids, activity, address);
    const cipher = buildCipherOperationsFeed(cipherListings, cipherActivity, address);
    return [...standard, ...cipher].sort((a, b) => b.timestamp - a.timestamp);
  }, [bids, activity, cipherListings, cipherActivity, address]);

  return { feed, loading };
}
