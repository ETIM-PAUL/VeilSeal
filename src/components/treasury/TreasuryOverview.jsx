import { Grid } from "@mantine/core";

import VaultSummary from "./VaultSummary";
import OperationTimeline from "./OperationTimeline";
import TeeHealthCard from "./TeeHealthCard";

export default function TreasuryOverview({ treasury }) {
  return (
    <Grid gutter="lg">

      <Grid.Col span={{ base: 12, lg: 8 }}>
        <OperationTimeline treasury={treasury} />
      </Grid.Col>

      <Grid.Col span={{ base: 12, lg: 4 }}>
        <VaultSummary treasury={treasury} />

        <div style={{ height: 16 }} />

        <TeeHealthCard />
      </Grid.Col>

    </Grid>
  );
}