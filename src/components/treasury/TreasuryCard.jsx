import { Card, Group, Stack, Text, Badge, Button, Divider } from "@mantine/core";
import { LuShieldCheck, LuUsers, LuWallet, LuArrowRight } from "react-icons/lu";
import { useNavigate } from "react-router-dom";

export default function TreasuryCard({ treasury }) {
  const navigate = useNavigate();

  return (
    <Card
      withBorder
      radius="lg"
      shadow="sm"
      padding="lg"
      style={{
        transition: "all .2s ease",
        cursor: "pointer"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <Group justify="space-between" mb="sm">
        <Stack gap={2}>
          <Text fw={700} size="lg">
            {treasury.name}
          </Text>

          <Text size="sm" c="dimmed">
            {treasury.type}
          </Text>
        </Stack>

        <Badge
          color="teal"
          leftSection={<LuShieldCheck size={12} />}
        >
          TEE Protected
        </Badge>
      </Group>

      <Divider my="md" />

      <Group grow mb="md">
        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            Balance
          </Text>

          <Text fw={700}>{treasury.balance}</Text>
        </Stack>

        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            Members
          </Text>

          <Group gap={4}>
            <LuUsers size={15} />
            <Text fw={600}>{treasury.members}</Text>
          </Group>
        </Stack>
      </Group>

      <Group grow mb="lg">
        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            Pending Operations
          </Text>

          <Text fw={600}>{treasury.operations}</Text>
        </Stack>

        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            Last Attestation
          </Text>

          <Text fw={600}>{treasury.lastAttestation}</Text>
        </Stack>
      </Group>

      <Button
        fullWidth
        rightSection={<LuArrowRight />}
        leftSection={<LuWallet />}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/treasuries/${treasury.id}`);
        }}
      >
        Open Treasury
      </Button>
    </Card>
  );
}