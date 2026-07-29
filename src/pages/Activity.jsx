import { Stack, Title, Text } from "@mantine/core";
import { LuActivity } from "react-icons/lu";

import EmptyState from "../components/common/EmptyState";

export default function Activity() {
  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>Activity</Title>

        <Text className="caption" mt={4}>
          All confidential operations.
        </Text>
      </div>

      <div className="panel">
        <EmptyState
          icon={LuActivity}
          title="No activity yet"
          description="Confidential operations across your treasuries and transfers will be logged here."
        />
      </div>
    </Stack>
  );
}
