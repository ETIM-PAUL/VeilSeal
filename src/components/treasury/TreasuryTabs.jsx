import TreasuryOverview from "./TreasuryOverview";
import TreasuryContributions from "./TreasuryContributions";
import { Tabs } from "@mantine/core";

export default function TreasuryTabs({
    treasury, contributions
}) {
  return (
    <Tabs defaultValue="overview">
      <Tabs.List>

        <Tabs.Tab value="overview">
          Overview
        </Tabs.Tab>

        <Tabs.Tab value="contributions">
          Contributions
        </Tabs.Tab>

      </Tabs.List>

      <Tabs.Panel
        value="overview"
        pt="xl"
        >

        <TreasuryOverview
        treasury={treasury}
        />

        </Tabs.Panel>

      <Tabs.Panel
        value="contributions"
        pt="xl"
        >

        <TreasuryContributions
        contributions={contributions}
        />

        </Tabs.Panel>

    </Tabs>
  );
}