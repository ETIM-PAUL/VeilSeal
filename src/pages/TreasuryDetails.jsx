import { useEffect, useState } from "react";
import { SimpleGrid, Stack } from "@mantine/core";
import { useParams } from "react-router-dom";

import { treasuries, treasuryContributions } from "../data/mockData";

import TreasuryHeader from "../components/treasury/TreasuryHeader";
import TreasuryHeaderSkeleton from "../components/treasury/TreasuryHeaderSkeleton";
import TreasuryStats from "../components/treasury/TreasuryStats";
import TreasuryTabs from "../components/treasury/TreasuryTabs";
import MetricCardSkeleton from "../components/common/MetricCardSkeleton";

export default function TreasuryDetails() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, [id]);

  const contributions =
  treasuryContributions[id] ?? [];

  const treasury =
    treasuries.find((item) => String(item.id) === id);

  if (!treasury) {
    return <>Treasury not found.</>;
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <TreasuryHeaderSkeleton />

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </SimpleGrid>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <TreasuryHeader treasury={treasury} />

      <TreasuryStats treasury={treasury} />

      <TreasuryTabs
      treasury={treasury}
      contributions={contributions}
      />
    </Stack>
  );
}