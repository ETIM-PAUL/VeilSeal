import { useMemo, useState } from "react";
import { Button, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { LuPlus, LuGavel } from "react-icons/lu";
import { useDisclosure } from "@mantine/hooks";

import BidCard from "../components/bids/BidCard";
import BidFilters from "../components/bids/BidFilters";
import NewBidDrawer from "../components/bids/NewBidDrawer";
import PlaceBidDrawer from "../components/bids/PlaceBidDrawer";
import BidDetailDrawer from "../components/bids/BidDetailDrawer";
import EmptyState from "../components/common/EmptyState";

import { bids as initialBids, MY_WALLET } from "../data/bids";
import { getBidStatus } from "../utils/bids";

export default function Bids() {
  const [bids, setBids] = useState(initialBids);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("deadline-asc");

  const [newOpened, { open: openNew, close: closeNew }] = useDisclosure(false);
  const [placeBidId, setPlaceBidId] = useState(null);
  const [detailBidId, setDetailBidId] = useState(null);

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
    const id = `BID-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    setBids((prev) => [
      { id, creator: MY_WALLET, participants: [], ...data },
      ...prev,
    ]);
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

          <Button leftSection={<LuPlus size={15} />} onClick={openNew}>
            New Bid
          </Button>
        </Group>

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
