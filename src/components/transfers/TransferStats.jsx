import { Card, SimpleGrid, Stack, Text } from "@mantine/core";

export default function TransferStats({ stats }) {
  const cards = [
    {
      title: "Total Sent",
      value: stats.totalSent,
    },
    {
      title: "Transfers",
      value: stats.transfers,
    },
    {
      title: "Pending",
      value: stats.pending,
    },
    {
      title: "Avg TEE Time",
      value: stats.avgExecution,
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
      {cards.map((card) => (
        <Card key={card.title} withBorder radius="lg" padding="lg">
          <Stack gap={2}>
            <Text size="sm" c="dimmed">
              {card.title}
            </Text>

            <Text fw={700} size="28px">
              {card.value}
            </Text>
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}