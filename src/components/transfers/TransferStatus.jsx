import { Card, SimpleGrid, Stack, Text } from "@mantine/core";

export default function TransferStats() {
  const stats = [
    {
      title: "Private Transfers",
      value: "126",
    },
    {
      title: "Pending TEE Jobs",
      value: "4",
    },
    {
      title: "Settled",
      value: "122",
    },
    {
      title: "Total Volume",
      value: "£42,860",
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }}>
      {stats.map((item) => (
        <Card key={item.title} withBorder radius="lg">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              {item.title}
            </Text>

            <Text fw={700} size="xl">
              {item.value}
            </Text>
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}