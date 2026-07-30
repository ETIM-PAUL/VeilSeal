import { Group, Skeleton, Stack, Text } from "@mantine/core";

export default function ActivityFeedSkeleton() {
  return (
    <div className="panel" style={{ padding: "18px 20px" }}>
      <Text className="label-micro-strong" mb="md">
        Recent Activity
      </Text>

      <Stack gap={0}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Group
            key={i}
            justify="space-between"
            py={12}
            className={i !== 4 ? "hairline-bottom" : ""}
            wrap="nowrap"
          >
            <div style={{ flex: 1 }}>
              <Skeleton height={12} width="40%" />
              <Skeleton height={9} width="25%" mt={8} />
            </div>

            <Skeleton height={18} width={64} radius="xl" />
          </Group>
        ))}
      </Stack>
    </div>
  );
}
