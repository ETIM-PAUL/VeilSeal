import { Group, Text, Badge } from "@mantine/core";

import { statusColor } from "../../utils/status";

export default function VaultSummary({ treasury }) {
  const rows = [
    { label: "Type", value: treasury.type },
    { label: "Network", value: "Coston2" },
    { label: "Custody", value: "TEE-Managed" },
  ];

  return (
    <div className="panel" style={{ padding: "18px 20px" }}>
      <Group justify="space-between" mb="md">
        <Text className="label-micro-strong">Vault Summary</Text>

        <Badge color={statusColor(treasury.status)}>
          {treasury.status ?? "Healthy"}
        </Badge>
      </Group>

      <div className="hairline-top" style={{ marginBottom: 4 }} />

      {rows.map((row, index) => (
        <Group
          key={row.label}
          justify="space-between"
          py={10}
          className={index !== rows.length - 1 ? "hairline-bottom" : ""}
        >
          <Text size="sm" className="ink-dim">
            {row.label}
          </Text>

          <Text size="sm" fw={600}>
            {row.value}
          </Text>
        </Group>
      ))}
    </div>
  );
}
