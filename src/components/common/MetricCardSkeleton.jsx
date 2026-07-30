import { Skeleton } from "@mantine/core";

export default function MetricCardSkeleton() {
  return (
    <div className="panel" style={{ padding: "16px 18px" }}>
      <Skeleton height={9} width="55%" />
      <Skeleton height={20} width="45%" mt={8} />
    </div>
  );
}
