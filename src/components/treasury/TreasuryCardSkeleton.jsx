import { Group, Skeleton, Stack } from "@mantine/core";

export default function TreasuryCardSkeleton() {
  return (
    <div className="panel" style={{ padding: 20 }}>
      <Group justify="space-between" mb="md" align="flex-start" wrap="nowrap">
        <Stack gap={6}>
          <Skeleton height={15} width={140} />
          <Skeleton height={9} width={70} />
        </Stack>

        <Skeleton height={20} width={56} radius="xl" />
      </Group>

      <div className="hairline-top" style={{ margin: "12px 0" }} />

      <Group grow mb="md" align="flex-start">
        <Stack gap={6}>
          <Skeleton height={9} width={50} />
          <Skeleton height={20} width={80} />
        </Stack>

        <Stack gap={6}>
          <Skeleton height={9} width={50} />
          <Skeleton height={20} width={40} />
        </Stack>
      </Group>

      <Group grow mb="lg" align="flex-start">
        <Stack gap={6}>
          <Skeleton height={9} width={60} />
          <Skeleton height={16} width={30} />
        </Stack>

        <Stack gap={6}>
          <Skeleton height={9} width={80} />
          <Skeleton height={16} width={70} />
        </Stack>
      </Group>

      <Skeleton height={36} radius={4} />
    </div>
  );
}
