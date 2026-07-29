import { Badge, Group, Stack, Text } from "@mantine/core";

import { LuBuilding2, LuWallet, LuShieldCheck } from "react-icons/lu";

function Section({ label, children }) {
  return (
    <div>
      <div className="label-micro" style={{ marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <Group justify="space-between" mt={4}>
      <Text size="sm" className="ink-dim">
        {label}
      </Text>

      <Text size="sm" fw={600} className={mono ? "num" : ""}>
        {value}
      </Text>
    </Group>
  );
}

export default function TreasuryPreview({ name, targetAmount, deadline }) {
  return (
    <div className="panel" style={{ padding: 20 }}>
      <Group gap={10} mb="lg" wrap="nowrap">
        <LuBuilding2 size={18} color="var(--signal)" />

        <Text fw={600} style={{ fontFamily: "var(--font-display)" }}>
          {name || "Untitled Treasury"}
        </Text>
      </Group>

      <Stack gap="lg">
        <Section label="Funding Goal">
          <Row
            label="Target"
            mono
            value={targetAmount ? `${targetAmount.toLocaleString()} FLR` : "Not set"}
          />
          <Row
            label="Deadline"
            value={deadline ? new Date(deadline).toLocaleDateString() : "No deadline"}
          />
        </Section>

        <div className="hairline-top" />

        <Section label="Owner">
          <Group gap={8}>
            <LuWallet size={14} className="ink-dim" />
            <Text size="sm">Connected Wallet</Text>
          </Group>
        </Section>

        <div className="hairline-top" />

        <Section label="Status">
          <Group gap={8}>
            <LuShieldCheck size={14} color="var(--signal)" />
            <Text size="sm">Ready to Deploy</Text>
          </Group>
        </Section>

        <div className="hairline-top" />

        <Section label="Deployment">
          <Row label="Estimated Cost" mono value="~0.02 FLR" />

          <Group justify="space-between" mt={4}>
            <Text size="sm" className="ink-dim">
              Network
            </Text>
            <Badge variant="outline" color="slate">
              Coston2
            </Badge>
          </Group>
        </Section>
      </Stack>
    </div>
  );
}
