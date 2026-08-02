import { useEffect, useState } from "react";
import { SimpleGrid, Grid, Stack, Title, Text, Button, Group } from "@mantine/core";

import { LuWallet, LuArrowLeftRight, LuGavel, LuUsers, LuPlus, LuShieldCheck } from "react-icons/lu";

import StatCard from "../components/dashboard/StatCard";
import StatCardSkeleton from "../components/common/StatCardSkeleton";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import ActivityFeedSkeleton from "../components/dashboard/ActivityFeedSkeleton";
import SignalScoreModal from "../components/dashboard/SignalScoreModal";

import { dashboardStats } from "../data/mockData";
import { useDisclosure } from "@mantine/hooks";
import NewTreasuryDrawer from "../components/treasury/NewTreasuryDrawer";
import NewTransferDrawer from "../components/transfers/NewTransferDrawer";
import NewBidDrawer from "../components/bids/NewBidDrawer";
import { useBids } from "../context/useBids";

const icons = [LuWallet, LuArrowLeftRight, LuGavel, LuUsers];

export default function Dashboard() {
  const { createListing } = useBids();

  const [opened, { open, close }] = useDisclosure(false);
  const [openedP2p, { open: openP2p, close: closeP2p }] = useDisclosure(false);
  const [scoreOpened, { open: openScore, close: closeScore }] = useDisclosure(false);
  // Dashboard's is the only NewBidDrawer entry point that shows the standard-
  // vs-stealth type toggle - Listings and Stealth Listings each open it
  // locked to one type instead (see their own "New" buttons).
  const [newBidOpened, { open: openNewBid, close: closeNewBid }] = useDisclosure(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Good afternoon</Title>

            <Text className="caption" mt={4} maw={520}>
              Private payments, treasury management, and sealed bidding powered
              by Flare Confidential Compute.
            </Text>
          </div>

          <Group gap="sm">
            <Button variant="subtle" leftSection={<LuShieldCheck size={15} />} onClick={openScore}>
              Check My Signal Score
            </Button>

            <Button leftSection={<LuPlus size={15} />}>New Transaction</Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            : dashboardStats.map((stat, index) => (
                <StatCard
                  key={stat.title}
                  title={stat.title}
                  value={stat.value}
                  description={stat.description}
                  icon={icons[index]}
                />
              ))}
        </SimpleGrid>

        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            {loading ? <ActivityFeedSkeleton /> : <ActivityFeed />}
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
                  onClick={open}
                  leftSection={<LuWallet size={15} />}
                >
                  New Treasury
                </Button>

                <Button
                  justify="flex-start"
                  variant="light"
                  onClick={openP2p}
                  leftSection={<LuArrowLeftRight size={15} />}
                >
                  Private Transfer
                </Button>

                <Button
                  justify="flex-start"
                  variant="light"
                  onClick={openNewBid}
                  leftSection={<LuGavel size={15} />}
                >
                  New Sealed Bid
                </Button>
              </Stack>
            </div>
          </Grid.Col>
        </Grid>
      </Stack>

      <NewTreasuryDrawer opened={opened} onClose={close} />
      <NewTransferDrawer opened={openedP2p} onClose={closeP2p} />
      <SignalScoreModal opened={scoreOpened} onClose={closeScore} />
      <NewBidDrawer opened={newBidOpened} onClose={closeNewBid} onCreate={createListing} />
    </>
  );
}
