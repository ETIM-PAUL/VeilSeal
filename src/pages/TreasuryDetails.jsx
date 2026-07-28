import { Stack } from "@mantine/core";
import { useParams } from "react-router-dom";

import { treasuries, treasuryContributions } from "../data/mockData";

import TreasuryHeader from "../components/treasury/TreasuryHeader";
import TreasuryStats from "../components/treasury/TreasuryStats";
import TreasuryTabs from "../components/treasury/TreasuryTabs";

export default function TreasuryDetails() {
  const { id } = useParams();

  const contributions =
  treasuryContributions[id] ?? [];

  const treasury =
    treasuries.find((item) => item.id === id);

  if (!treasury) {
    return <>Treasury not found.</>;
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