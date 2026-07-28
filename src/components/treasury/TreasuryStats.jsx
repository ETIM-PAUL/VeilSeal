import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";

export default function TreasuryStats({ treasury }) {
  const stats = [
    {
      label: "Treasury Balance",
      value: treasury.balance
    },
    {
      label: "Members",
      value: treasury.members
    },
    {
      label: "Pending Operations",
      value: treasury.operations
    },
    {
      label: "Last Attestation",
      value: treasury.lastAttestation
    }
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
      {stats.map((stat) => (
        <Card
          key={stat.label}
          withBorder
          radius="lg"
        >
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              {stat.label}
            </Text>

            <Text fw={700} size="xl">
              {stat.value}
            </Text>
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}