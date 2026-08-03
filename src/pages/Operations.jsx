import { useMemo, useState } from "react";
import { SimpleGrid, Stack, Text, Title, Loader } from "@mantine/core";
import { LuActivity, LuHourglass, LuCheckCheck, LuShieldCheck } from "react-icons/lu";

import StatCard from "../components/dashboard/StatCard";
import StatCardSkeleton from "../components/common/StatCardSkeleton";
import OperationsFilters from "../components/operations/OperationsFilters";
import OperationsTable from "../components/operations/OperationsTable";
import OperationDrawer from "../components/operations/OperationDrawer";
import EmptyState from "../components/common/EmptyState";

import { useOperationsFeed } from "../hooks/useOperationsFeed";
import { PENDING_STATUSES, RESOLVED_STATUSES } from "../utils/operations";

export default function Operations() {
  // Bid activity (Sealed/Won/Lost/Withdrawn) is a global feed across every
  // bidder - only the sealed amount is ever confidential, not who bid.
  // "Listing" rows are the one part scoped to the connected wallet: listings
  // it created. Both are standard-listing-only - see buildOperationsFeed's
  // comment on why stealth listings never appear here. Shared with
  // Dashboard's activity feed/stat cards - see useOperationsFeed.
  const { feed, loading } = useOperationsFeed();

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
            Every sealed bid, reveal, and withdrawal across the marketplace, plus the listings
            your connected wallet has created - sourced directly from on-chain activity processed
            through Flare Confidential Compute.
          </Text>

          <Text size="xs" className="ink-faint" mt={6}>
            <LuShieldCheck size={12} style={{ verticalAlign: "-1px", marginRight: 4 }} />
            Standard listings only - stealth listings stay encrypted and undiscoverable by design,
            so their bids and creation never appear here, even for the wallet that created them.
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
            <StatCard title="Pending" value={stats.pending} icon={LuHourglass} description="Sealed or awaiting reveal" />
            <StatCard title="Resolved" value={stats.resolved} icon={LuCheckCheck} description="Won, lost, withdrawn, or revealed" />
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
              description="Try adjusting your filters - sealed bids, reveals, withdrawals, and your own listings will appear here."
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
