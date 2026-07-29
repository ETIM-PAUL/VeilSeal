import { useMemo, useState } from "react";
import { SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { LuActivity, LuHourglass, LuCheckCheck, LuOctagonAlert } from "react-icons/lu";

import StatCard from "../components/dashboard/StatCard";
import OperationsFilters from "../components/operations/OperationsFilters";
import OperationsTable from "../components/operations/OperationsTable";
import OperationDrawer from "../components/treasury/OperationDrawer";
import EmptyState from "../components/common/EmptyState";

import { buildOperationsFeed } from "../utils/operations";

const PENDING_STATUSES = ["Queued", "Relayed", "Executing", "Sealed"];
const RESOLVED_STATUSES = ["Settled", "Won", "Lost", "Withdrawn"];

export default function Operations() {
  const feed = useMemo(() => buildOperationsFeed(), []);

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
      failed: feed.filter((op) => op.status === "Failed").length,
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
            Every confidential operation — contributions, transfers, and sealed bids — processed through Flare Confidential Compute.
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <StatCard title="Total Operations" value={stats.total} icon={LuActivity} />
          <StatCard title="Pending" value={stats.pending} icon={LuHourglass} description="Queued, relayed, executing, or sealed" />
          <StatCard title="Resolved" value={stats.resolved} icon={LuCheckCheck} description="Settled, won, lost, or withdrawn" />
          <StatCard title="Failed" value={stats.failed} icon={LuOctagonAlert} />
        </SimpleGrid>

        <OperationsFilters
          search={search}
          onSearch={setSearch}
          type={type}
          onType={setType}
          status={status}
          onStatus={setStatus}
          statusOptions={statusOptions}
        />

        {filtered.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={LuActivity}
              title="No operations found"
              description="Try adjusting your filters — confidential operations from treasuries, transfers, and bids will appear here."
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
