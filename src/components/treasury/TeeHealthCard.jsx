import { Stack, Group, Badge, Text } from "@mantine/core";

const rows = [
  { label: "Pending Jobs", value: "4" },
  { label: "Average Execution", value: "2.3 s" },
  { label: "Last Attestation", value: "2 mins ago" },
];

export default function TeeHealthCard() {
  return (
    <div className="panel" style={{ padding: "18px 20px" }}>
      <Group justify="space-between" mb="md">
        <Text className="label-micro-strong">TEE Health</Text>

        <Badge color="signal">Healthy</Badge>
      </Group>

      <div className="hairline-top" style={{ marginBottom: 4 }} />

      <Stack gap={0}>
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

            <Text size="sm" fw={600} className="num">
              {row.value}
            </Text>
          </Group>
        ))}
      </Stack>
    </div>
  );
}
