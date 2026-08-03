import { Stack, Group, Text, Badge } from "@mantine/core";

import { statusColor } from "../../utils/status";

export default function ActivityFeed({ items = [] }) {
  return (
    <div className="panel" style={{ padding: "18px 20px" }}>
      <Text className="label-micro-strong" mb="md">
        Recent Activity
      </Text>

      {items.length === 0 ? (
        <Text className="caption" py="md">
          No activity yet - sealed bids, reveals, and your own listings will show up here.
        </Text>
      ) : (
        <Stack gap={0}>
          {items.map((item, index) => (
            <Group
              key={item.id}
              justify="space-between"
              py={12}
              className={index !== items.length - 1 ? "hairline-bottom" : ""}
              wrap="nowrap"
            >
              <div>
                <Text size="sm" fw={500}>
                  {item.title}
                </Text>

                <Text className="caption" mt={2}>
                  {item.time}
                </Text>
              </div>

              <Badge color={statusColor(item.status)} variant="outline">
                {item.status}
              </Badge>
            </Group>
          ))}
        </Stack>
      )}
    </div>
  );
}
