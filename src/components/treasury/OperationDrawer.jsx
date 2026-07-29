import { Drawer, Stack, Badge, Text, Group } from "@mantine/core";

import OperationTimeline from "./OperationTimeline";
import { statusColor } from "../../utils/status";

export default function OperationDrawer({ opened, close }) {
  return (
    <Drawer opened={opened} onClose={close} title="Confidential Operation" position="right" size="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={600} style={{ fontFamily: "var(--font-display)" }}>
            Contribution
          </Text>

          <Badge color={statusColor("Executing")}>Executing</Badge>
        </Group>

        <div>
          <div className="label-micro">Amount</div>
          <div className="num-lg" style={{ marginTop: 4 }}>
            500 FLR
          </div>
        </div>

        <OperationTimeline current={2} />
      </Stack>
    </Drawer>
  );
}
