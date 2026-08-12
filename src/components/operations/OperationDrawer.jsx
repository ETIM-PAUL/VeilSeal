import { useState } from "react";
import { Drawer, Stack, Badge, Text, Group } from "@mantine/core";

import OperationTimeline from "./OperationTimeline";
import { statusColor } from "../../utils/status";
import { OPERATION_STEPS, getOperationProgress, finalStepLabel } from "../../utils/operations";

export default function OperationDrawer({ opened, onClose, operation: liveOperation }) {
  // Keep the last known operation around so the drawer content stays in
  // place while it animates closed, instead of vanishing mid-transition.
  const [cached, setCached] = useState(liveOperation);
  if (liveOperation && liveOperation !== cached) {
    setCached(liveOperation);
  }
  const operation = liveOperation ?? cached;

  if (!operation) return null;

  const { current, failed } = getOperationProgress(operation);
  const steps = [...OPERATION_STEPS, finalStepLabel(operation.status, operation.type)];

  return (
    <Drawer opened={opened} onClose={onClose} title="Confidential Operation" position="right" size="md">
      <Stack>
        <Group justify="space-between" align="flex-start">
          <div>
            <Text className="label-micro">{operation.type}</Text>
            <Text fw={600} style={{ fontFamily: "var(--font-display)" }}>
              {operation.party}
            </Text>
          </div>

          <Badge color={statusColor(operation.status)}>{operation.status}</Badge>
        </Group>

        <div className="hairline-top" />

        <Group grow align="flex-start">
          <div>
            <div className="label-micro">Amount</div>
            <div className="num-lg" style={{ marginTop: 4 }}>
              {operation.amount} {operation.token}
            </div>
          </div>

          <div>
            <div className="label-micro">Submitted</div>
            <Text size="sm" fw={500} mt={4}>
              {operation.time}
            </Text>
          </div>
        </Group>

        <div>
          <div className="label-micro">Wallet</div>
          <Text size="sm" fw={600} className="num" mt={4}>
            {operation.wallet}
          </Text>
        </div>

        <div>
          <div className="label-micro">Transaction Hash</div>
          <Text size="sm" className="ink-faint num" mt={4} style={{ wordBreak: "break-all" }}>
            {operation.txHash}
          </Text>
        </div>

        <OperationTimeline current={current} failed={failed} steps={steps} />
      </Stack>
    </Drawer>
  );
}
