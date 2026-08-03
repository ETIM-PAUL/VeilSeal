import { useEffect, useMemo, useState } from "react";
import { SimpleGrid, Stack, Text, Title, Loader } from "@mantine/core";
import { LuActivity, LuHourglass, LuCheckCheck } from "react-icons/lu";

import StatCard from "../components/dashboard/StatCard";
import StatCardSkeleton from "../components/common/StatCardSkeleton";
import OperationsFilters from "../components/operations/OperationsFilters";
import OperationsTable from "../components/operations/OperationsTable";
import OperationDrawer from "../components/operations/OperationDrawer";
import EmptyState from "../components/common/EmptyState";

import { useBids } from "../context/useBids";
import { fetchBidActivity } from "../contracts/VeilBidding";
import { buildOperationsFeed } from "../utils/operations";

const PENDING_STATUSES = ["Sealed"];
const RESOLVED_STATUSES = ["Won", "Lost", "Withdrawn"];

export default function Operations() {
  // Listings/participants come from BidsContext (already fetched for the
  // Listings page); activity (real tx hashes + timestamps for each sealed/
  // cancelled bid) is fetched once here - see fetchBidActivity.
  const { bids, loading: bidsLoading } = useBids();
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

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

  const loading = bidsLoading || activityLoading;
  const feed = useMemo(() => buildOperationsFeed(bids, activity), [bids, activity]);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    return feed.filter((op) => {
      const matchesSearch = `${op.party} ${op.wallet}`.toLowerCase().includes(search.toLowerCase());
      const matchesType = type === "All" || op.type === type;
      const matchesStatus = status === "All" || op.status === status;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [feed, search, type, status]);

  const stats = useMemo(
    () => ({
      total: feed.length,
      pending: feed.filter((op) => PENDING_STATUSES.includes(op.status)).length,
      resolved: feed.filter((op) => RESOLVED_STATUSES.includes(op.status)).length,
    }),
    [feed]
  );

  const statusOptions = useMemo(
    () => ["All", ...new Set(feed.map((op) => op.status))],
    [feed]
  );

  const selected = feed.find((op) => op.id === selectedId);

  return (
    <>
      <Stack gap="xl">
        <div>
          <Title order={2}>Operations</Title>

          <Text className="caption" mt={4}>
            Every sealed bid, reveal, and withdrawal, sourced directly from on-chain activity
            processed through Flare Confidential Compute.
          </Text>
        </div>

        {loading ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </SimpleGrid>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            <StatCard title="Total Operations" value={stats.total} icon={LuActivity} />
            <StatCard title="Pending" value={stats.pending} icon={LuHourglass} description="Sealed, awaiting reveal" />
            <StatCard title="Resolved" value={stats.resolved} icon={LuCheckCheck} description="Won, lost, or withdrawn" />
          </SimpleGrid>
        )}

        <OperationsFilters
          search={search}
          onSearch={setSearch}
          type={type}
          onType={setType}
          status={status}
          onStatus={setStatus}
          statusOptions={statusOptions}
        />

        {loading ? (
          <div className="panel" style={{ padding: 40, textAlign: "center" }}>
            <Loader size="sm" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={LuActivity}
              title="No operations found"
              description="Try adjusting your filters - sealed bids, reveals, and withdrawals will appear here."
            />
          </div>
        ) : (
          <OperationsTable operations={filtered} onOpen={setSelectedId} />
        )}
      </Stack>

      <OperationDrawer opened={!!selectedId} onClose={() => setSelectedId(null)} operation={selected} />
    </>
  );
}
