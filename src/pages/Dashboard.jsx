import { useMemo, useState } from "react";
import { SimpleGrid, Grid, Stack, Title, Text, Button, Group } from "@mantine/core";

import { LuGavel, LuLockKeyhole, LuPuzzle, LuTrophy, LuListPlus, LuShieldCheck } from "react-icons/lu";

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
import { activityTitle } from "../utils/operations";

export default function Dashboard() {
  const { createListing } = useBids();
  const { createCipherListing } = useCipherListings();
  // Same real on-chain feed the Operations page reads - see
  // useOperationsFeed/buildOperationsFeed for what's in it (the connected
  // wallet's own bid/guess activity and listings, covering standard and
  // Cipher listings - stealth listings are excluded by design).
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

  // "Bid"/"Guess" rows (won/bidded) come from fetchBidActivity/
  // fetchCipherGuessActivity, both capped to a trailing 3-day block window
  // (see contracts/VeilBidding.js's ACTIVITY_LOOKBACK_DAYS) - a bid/guess
  // sealed further back than that has aged out of the feed entirely, even if
  // it later won. "Listing"/"Cipher Listing" rows (created) have no such
  // window - fetchAllListings/fetchAllCipherListings read every listing via
  // listingCount()+listings(id)/cipherListings(id) view calls (see
  // buildOperationsFeed's comment on why there's no creation timestamp to
  // filter by anyway). All three are already wallet-scoped by
  // buildOperationsFeed/buildCipherOperationsFeed and cover both Standard
  // and Cipher listings (never Stealth - see the same comment).
  const stats = useMemo(
    () => ({
      won: feed.filter((op) => (op.type === "Bid" || op.type === "Guess") && op.status === "Won").length,
      created: feed.filter((op) => op.type === "Listing" || op.type === "Cipher Listing").length,
      bidded: feed.filter((op) => op.type === "Bid" || op.type === "Guess").length,
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
              <StatCard title="Listings Won" value={stats.won} icon={LuTrophy} description="Standard + Cipher · Last 3 days" />
              <StatCard title="Total Bidded" value={stats.bidded} icon={LuGavel} description="Standard + Cipher · Last 3 days" />
              <StatCard title="Listings Created" value={stats.created} icon={LuListPlus} description="Standard + Cipher · All time" />
            </>
          )}
        </SimpleGrid>

        <Text size="xs" className="ink-faint" mt={-10}>
          <LuShieldCheck size={12} style={{ verticalAlign: "-1px", marginRight: 4 }} />
          "Won" and "Bidded" only cover the last 3 days - sealed bids/guesses older than that age
          out of the feed even if later revealed as a win. "Created" has no such window (there's no
          reliable creation timestamp to filter by) and reflects all time. All three are your
          connected wallet only, across Standard and Cipher listings - Stealth listings stay
          encrypted and undiscoverable by design, so they never appear here.
        </Text>

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
