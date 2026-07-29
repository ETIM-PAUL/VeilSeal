import { Group, Stack, Text, Badge, Button } from "@mantine/core";
import { LuShieldCheck, LuUsers, LuWallet, LuArrowRight } from "react-icons/lu";
import { useNavigate } from "react-router-dom";

export default function TreasuryCard({ treasury }) {
  const navigate = useNavigate();

  return (
    <div
      className="panel"
      style={{ padding: 20, cursor: "pointer" }}
      onClick={() => navigate(`/treasuries/${treasury.id}`)}
    >
      <Group justify="space-between" mb="md" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Text fw={600} size="md" style={{ fontFamily: "var(--font-display)" }}>
            {treasury.name}
          </Text>

          <Text className="label-micro">{treasury.type}</Text>
        </Stack>

        <Badge color="signal" leftSection={<LuShieldCheck size={11} />}>
          TEE
        </Badge>
      </Group>

      <div className="hairline-top" style={{ margin: "12px 0" }} />

      <Group grow mb="md" align="flex-start">
        <Stack gap={2}>
          <Text className="label-micro">Balance</Text>
          <div className="num-lg">{treasury.balance}</div>
        </Stack>

        <Stack gap={2}>
          <Text className="label-micro">Members</Text>
          <Group gap={4}>
            <LuUsers size={13} className="ink-dim" />
            <div className="num-lg">{treasury.members}</div>
          </Group>
        </Stack>
      </Group>

      <Group grow mb="lg" align="flex-start">
        <Stack gap={2}>
          <Text className="label-micro">Pending Ops</Text>
          <div className="num-md">{treasury.operations}</div>
        </Stack>

        <Stack gap={2}>
          <Text className="label-micro">Last Attestation</Text>
          <Text size="sm" fw={500}>
            {treasury.lastAttestation}
          </Text>
        </Stack>
      </Group>

      <Button
        fullWidth
        variant="light"
        rightSection={<LuArrowRight size={15} />}
        leftSection={<LuWallet size={15} />}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/treasuries/${treasury.id}`);
        }}
      >
        Open Treasury
      </Button>
    </div>
  );
}
