import { Group, Skeleton } from "@mantine/core";

export default function StatCardSkeleton() {
  return (
    <div className="panel" style={{ padding: "18px 20px" }}>
      <Group justify="space-between" mb={14} wrap="nowrap" align="flex-start">
        <Skeleton height={9} width="50%" />
        <Skeleton height={15} width={15} circle />
      </Group>

      <Skeleton height={22} width="65%" />
      <Skeleton height={10} width="80%" mt={8} />
    </div>
  );
}
