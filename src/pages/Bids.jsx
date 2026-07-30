import { useEffect, useMemo, useState } from "react";
import { Button, Group, Loader, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { LuPlus, LuGavel, LuRefreshCw } from "react-icons/lu";
import { useDisclosure } from "@mantine/hooks";

import BidCard from "../components/bids/BidCard";
import BidFilters from "../components/bids/BidFilters";
import NewBidDrawer from "../components/bids/NewBidDrawer";
import PlaceBidDrawer from "../components/bids/PlaceBidDrawer";
import BidDetailDrawer from "../components/bids/BidDetailDrawer";
import EmptyState from "../components/common/EmptyState";

import { bids as seedBids, MY_WALLET } from "../data/bids";
import { getBidStatus } from "../utils/bids";
import { useWallet } from "../context/useWallet";
import { fetchAllListings, fetchBidders, isContractConfigured } from "../contracts/VeilBidding";

// Listing metadata (title, description, item type, image) isn't stored
// on-chain — only the sealed-bid mechanics are. This app has no backend/
// indexer to host that metadata, so the *creating* browser caches it in
// localStorage, keyed by on-chain listing id. Any listing discovered purely
// from chain events (e.g. opened from a different browser/account) falls
// back to a generic placeholder — the contract state itself (deadline,
// bidders, reveal result) is always authoritative regardless.
const METADATA_KEY = "veilpay:bid-metadata";

function loadMetadataCache() {
  try {
    return JSON.parse(localStorage.getItem(METADATA_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveMetadata(listingId, metadata) {
  const cache = loadMetadataCache();
  cache[listingId] = metadata;
  localStorage.setItem(METADATA_KEY, JSON.stringify(cache));
}

function placeholderMetadata(listingId) {
  return {
    title: `Sealed Listing #${listingId}`,
    description: "On-chain sealed-bid listing — metadata not available in this browser.",
    itemType: "file",
    previewUrl: "",
    ipfsHash: "",
    minBid: 0,
    token: "FLR",
  };
}

export default function Bids() {
  const { address } = useWallet();

  const [bids, setBids] = useState(seedBids);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("deadline-asc");

  const [newOpened, { open: openNew, close: closeNew }] = useDisclosure(false);
  const [placeBidId, setPlaceBidId] = useState(null);
  const [detailBidId, setDetailBidId] = useState(null);

  // Discover every listing that exists on-chain (created by any account, in
  // any browser) and merge it into the display list — this is what makes a
  // listing created from one account visible and biddable from another.
  useEffect(() => {
    if (!isContractConfigured()) return;
    let cancelled = false;

    (async () => {
      setChainLoading(true);
      setChainError(null);
      try {
        const listings = await fetchAllListings();
        const metadataCache = loadMetadataCache();

        const merged = await Promise.all(
          listings.map(async (listing) => {
            const listingId = listing.listingId.toString();
            const metadata = metadataCache[listingId] ?? placeholderMetadata(listingId);

            const bidders = await fetchBidders(listing.listingId).catch(() => []);

            const participants = bidders.map((wallet, index) => ({
              id: index + 1,
              wallet,
              amount: 0,
              token: metadata.token,
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
              participants,
              ...metadata,
            };
          })
        );

        if (cancelled) return;

        setBids((prev) => {
          // Keep any purely-local seed/demo bids (no onChainListingId) and
          // replace/merge everything else with the freshly fetched on-chain set.
          const localOnly = prev.filter((b) => !b.onChainListingId);
          const byId = new Map(merged.map((b) => [b.onChainListingId, b]));

          // Preserve richer local metadata for a listing this session already
          // knew about (e.g. one just created) if the fetch's placeholder
          // would otherwise clobber it.
          for (const existing of prev) {
            if (existing.onChainListingId && byId.has(existing.onChainListingId)) {
              const fetched = byId.get(existing.onChainListingId);
              byId.set(existing.onChainListingId, {
                ...fetched,
                title: existing.title ?? fetched.title,
                description: existing.description ?? fetched.description,
                itemType: existing.itemType ?? fetched.itemType,
                previewUrl: existing.previewUrl ?? fetched.previewUrl,
                ipfsHash: existing.ipfsHash ?? fetched.ipfsHash,
                minBid: existing.minBid || fetched.minBid,
                token: existing.token ?? fetched.token,
              });
            }
          }

          return [...localOnly, ...byId.values()];
        });
      } catch (err) {
        if (!cancelled) setChainError(err?.message ?? "Failed to fetch on-chain listings.");
      } finally {
        if (!cancelled) setChainLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshTick, address]);

  const refresh = () => setRefreshTick((t) => t + 1);

  const filtered = useMemo(() => {
    const list = bids
      .filter((b) => b.title.toLowerCase().includes(search.toLowerCase()))
      .filter((b) => type === "All" || b.itemType === type)
      .filter((b) => status === "All" || getBidStatus(b) === status);

    return [...list].sort((a, b) => {
      const diff = new Date(a.deadline) - new Date(b.deadline);
      return sort === "deadline-asc" ? diff : -diff;
    });
  }, [bids, search, type, status, sort]);

  const handleCreate = (data) => {
    const onChainListingId = data.onChainListingId;

    if (onChainListingId) {
      saveMetadata(onChainListingId, {
        title: data.title,
        description: data.description,
        itemType: data.itemType,
        previewUrl: data.previewUrl,
        ipfsHash: data.ipfsHash,
        minBid: data.minBid,
        token: data.token,
      });
    }

    const id = onChainListingId ? `chain-${onChainListingId}` : `BID-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    setBids((prev) => [{ id, creator: MY_WALLET, participants: [], ...data }, ...prev]);

    // Pick up the real on-chain state (bidders, deadline) on the next fetch.
    if (onChainListingId) refresh();
  };

  const handlePlaceBid = ({ amount, token, wallet, termsCommitment, txHash }) => {
    setBids((prev) =>
      prev.map((b) =>
        b.id === placeBidId
          ? {
              ...b,
              participants: [
                ...b.participants,
                {
                  id: b.participants.length + 1,
                  wallet,
                  amount,
                  token,
                  submittedAt: "Just now",
                  mine: true,
                  withdrawn: false,
                  termsCommitment,
                  txHash,
                },
              ],
            }
          : b
      )
    );
    refresh();
  };

  const handleWithdraw = (bidId, participantId) => {
    setBids((prev) =>
      prev.map((b) =>
        b.id === bidId
          ? {
              ...b,
              participants: b.participants.map((p) =>
                p.id === participantId ? { ...p, withdrawn: true } : p
              ),
            }
          : b
      )
    );
  };

  const placeBidTarget = bids.find((b) => b.id === placeBidId);
  const detailTarget = bids.find((b) => b.id === detailBidId);

  return (
    <>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Closed Bids</Title>

            <Text className="caption" mt={4}>
              Sealed auctions and private tenders, resolved through Flare
              Confidential Compute.
            </Text>
          </div>

          <Group gap="sm">
            <Button
              variant="subtle"
              size="sm"
              leftSection={chainLoading ? <Loader size={13} /> : <LuRefreshCw size={15} />}
              onClick={refresh}
              disabled={chainLoading}
            >
              Refresh
            </Button>

            <Button leftSection={<LuPlus size={15} />} onClick={openNew}>
              New Bid
            </Button>
          </Group>
        </Group>

        {chainError && (
          <Text size="sm" style={{ color: "var(--danger)" }}>
            {chainError}
          </Text>
        )}

        <BidFilters
          search={search}
          onSearch={setSearch}
          type={type}
          onType={setType}
          status={status}
          onStatus={setStatus}
          sort={sort}
          onSort={setSort}
        />

        {filtered.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={LuGavel}
              title="No bids found"
              description="Try adjusting your filters, or create a new sealed bid listing."
            />
          </div>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }}>
            {filtered.map((bid) => (
              <BidCard key={bid.id} bid={bid} onOpen={setDetailBidId} />
            ))}
          </SimpleGrid>
        )}
      </Stack>

      <NewBidDrawer opened={newOpened} onClose={closeNew} onCreate={handleCreate} />

      <PlaceBidDrawer
        opened={!!placeBidId}
        onClose={() => setPlaceBidId(null)}
        bid={placeBidTarget}
        onSubmit={handlePlaceBid}
      />

      <BidDetailDrawer
        opened={!!detailBidId}
        onClose={() => setDetailBidId(null)}
        bid={detailTarget}
        onPlaceBid={(id) => {
          setDetailBidId(null);
          setPlaceBidId(id);
        }}
        onWithdraw={handleWithdraw}
      />
    </>
  );
}
