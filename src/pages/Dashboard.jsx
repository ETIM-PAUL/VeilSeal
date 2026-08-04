import { useMemo, useState } from "react";
import { SimpleGrid, Grid, Stack, Title, Text, Button, Group } from "@mantine/core";

import { LuGavel, LuLockKeyhole, LuPuzzle, LuActivity, LuHourglass, LuCheckCheck, LuShieldCheck } from "react-icons/lu";

import StatCard from "../components/dashboard/StatCard";
import StatCardSkeleton from "../components/common/StatCardSkeleton";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import ActivityFeedSkeleton from "../components/dashboard/ActivityFeedSkeleton";
import SignalScoreModal from "../components/dashboard/SignalScoreModal";

import { useDisclosure } from "@mantine/hooks";
import NewBidDrawer from "../components/bids/NewBidDrawer";
import NewCipherListingDrawer from "../components/cipher/NewCipherListingDrawer";
import { useBids } from "../context/useBids";
import { useCipherListings } from "../context/useCipherListings";
import { useOperationsFeed } from "../hooks/useOperationsFeed";
import { PENDING_STATUSES, RESOLVED_STATUSES, activityTitle, operationsThisMonth } from "../utils/operations";

export default function Dashboard() {
  const { createListing } = useBids();
  const { createCipherListing } = useCipherListings();
  // Same real on-chain feed the Operations page reads - see
  // useOperationsFeed/buildOperationsFeed for what's in it (global bid
  // activity + the connected wallet's own listings, standard listings only).
  const { feed, loading } = useOperationsFeed();

  const [scoreOpened, { open: openScore, close: closeScore }] = useDisclosure(false);
  // Dashboard is the one place that offers all three listing types from a
  // single panel - Standard/Stealth Listings and Cipher Listings each open
  // their own drawer locked to one type instead (see their own "New" buttons).
  const [bidLockedType, setBidLockedType] = useState("standard");
  const [newBidOpened, { open: openNewBidDrawer, close: closeNewBid }] = useDisclosure(false);
  const [newCipherOpened, { open: openNewCipher, close: closeNewCipher }] = useDisclosure(false);

  const openNewBid = (type) => {
    setBidLockedType(type);
    openNewBidDrawer();
  };

  const stats = useMemo(
    () => ({
      total: operationsThisMonth(feed).length,
      pending: feed.filter((op) => PENDING_STATUSES.includes(op.status)).length,
      resolved: feed.filter((op) => RESOLVED_STATUSES.includes(op.status)).length,
    }),
    [feed]
  );

  const recentActivity = useMemo(
    () => feed.slice(0, 3).map((op) => ({ id: op.id, title: activityTitle(op), time: op.time, status: op.status })),
    [feed]
  );

  return (
    <>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Good afternoon</Title>

            <Text className="caption" mt={4} maw={520}>
              Sealed-bid and skill-based auctions powered by Flare Confidential
              Compute.
            </Text>
          </div>

          <Group gap="sm">
            <Button variant="filled" leftSection={<LuShieldCheck size={15} />} onClick={openScore}>
              Check My Signal Score
            </Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard title="Total Operations" value={stats.total} icon={LuActivity} description="This month" />
              <StatCard title="Pending" value={stats.pending} icon={LuHourglass} description="Sealed or awaiting reveal" />
              <StatCard title="Resolved" value={stats.resolved} icon={LuCheckCheck} description="Won, lost, withdrawn, or revealed" />
            </>
          )}
        </SimpleGrid>

        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            {loading ? <ActivityFeedSkeleton /> : <ActivityFeed items={recentActivity} />}
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <div className="panel" style={{ padding: "18px 20px" }}>
              <Text className="label-micro-strong" mb="md">
                Quick Actions
              </Text>

              <Stack gap={8}>
                <Button
                  justify="flex-start"
                  variant="light"
                  onClick={() => openNewBid("standard")}
                  leftSection={<LuGavel size={15} />}
                >
                  Standard Listing
                </Button>

                <Button
                  justify="flex-start"
                  variant="light"
                  onClick={() => openNewBid("stealth")}
                  leftSection={<LuLockKeyhole size={15} />}
                >
                  Stealth Listing
                </Button>

                <Button
                  justify="flex-start"
                  variant="light"
                  onClick={openNewCipher}
                  leftSection={<LuPuzzle size={15} />}
                >
                  Cipher Listing
                </Button>
              </Stack>
            </div>
          </Grid.Col>
        </Grid>
      </Stack>

      <SignalScoreModal opened={scoreOpened} onClose={closeScore} />
      <NewBidDrawer opened={newBidOpened} onClose={closeNewBid} onCreate={createListing} lockedType={bidLockedType} />
      <NewCipherListingDrawer opened={newCipherOpened} onClose={closeNewCipher} onCreate={createCipherListing} />
    </>
  );
}
