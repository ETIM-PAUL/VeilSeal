import { Stack, Group, Text, Badge } from "@mantine/core";

import { mockActivity } from "../../data/mockData";
import { statusColor } from "../../utils/status";

export default function ActivityFeed() {
  return (
    <div className="panel" style={{ padding: "18px 20px" }}>
      <Text className="label-micro-strong" mb="md">
        Recent Activity
      </Text>

      <Stack gap={0}>
        {mockActivity.map((item, index) => (
          <Group
            key={item.id}
            justify="space-between"
            py={12}
            className={index !== mockActivity.length - 1 ? "hairline-bottom" : ""}
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
    </div>
  );
}
