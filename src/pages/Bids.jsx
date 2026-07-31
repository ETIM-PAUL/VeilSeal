import { useEffect, useMemo, useState } from "react";
import { Button, Group, Loader, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { LuPlus, LuGavel, LuRefreshCw } from "react-icons/lu";
import { useDisclosure } from "@mantine/hooks";

import BidCard from "../components/bids/BidCard";
import BidCardSkeleton from "../components/bids/BidCardSkeleton";
import BidFilters from "../components/bids/BidFilters";
import NewBidDrawer from "../components/bids/NewBidDrawer";
import PlaceBidDrawer from "../components/bids/PlaceBidDrawer";
import BidDetailDrawer from "../components/bids/BidDetailDrawer";
import EmptyState from "../components/common/EmptyState";

import { getBidStatus } from "../utils/bids";
import { useWallet } from "../context/useWallet";
import { fetchAllListings, fetchBidders, fetchOnChainListing, isContractConfigured } from "../contracts/VeilBidding";

export default function Bids() {
  const { address } = useWallet();

  // Bids shown here are exclusively what's discovered on-chain — no seed/mock
  // listings. See the fetch effect below.
  const [bids, setBids] = useState([]);
  const [chainLoading, setChainLoading] = useState(() => isContractConfigured());
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
  // any browser) — this is what makes a listing created from one account
  // visible and biddable from another.
  useEffect(() => {
    if (!isContractConfigured()) return;
    let cancelled = false;

    (async () => {
      setChainLoading(true);
      setChainError(null);
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
              minBid: Number(listing.minBid),
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
    if (!onChainListingId) return; // creation always goes through the real contract now

    setBids((prev) => [{ id: `chain-${onChainListingId}`, participants: [], ...data }, ...prev]);

    // Pick up the authoritative on-chain state (bidders, exact field values) on the next fetch.
    refresh();
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
  const initialLoad = chainLoading && bids.length === 0;

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

        {initialLoad ? (
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <BidCardSkeleton key={i} />
            ))}
          </SimpleGrid>
        ) : filtered.length === 0 ? (
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
