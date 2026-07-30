import { Group, Skeleton } from "@mantine/core";

export default function BidCardSkeleton() {
  return (
    <div className="panel" style={{ padding: 16 }}>
      <Skeleton height={140} radius={4} />

      <Group justify="space-between" mt="md" mb={2} align="flex-start" wrap="nowrap">
        <Skeleton height={14} width="55%" />
        <Skeleton height={18} width={56} radius="xl" />
      </Group>

      <Skeleton height={11} mt={10} width="90%" />
      <Skeleton height={11} mt={6} width="70%" mb="md" />

      <Group justify="space-between" align="flex-end" mt="sm">
        <div>
          <Skeleton height={9} width={50} />
          <Skeleton height={16} width={70} mt={6} />
        </div>

        <div style={{ textAlign: "right" }}>
          <Skeleton height={9} width={60} />
          <Skeleton height={13} width={30} mt={6} ml="auto" />
        </div>
      </Group>
    </div>
  );
}
