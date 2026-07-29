import { Badge, Button, Group, Stack, Text, Title } from "@mantine/core";
import { LuArrowLeft, LuShieldCheck } from "react-icons/lu";
import { useNavigate } from "react-router-dom";

export default function TreasuryHeader({ treasury }) {
  const navigate = useNavigate();

  return (
    <Group justify="space-between" align="flex-start">
      <Group align="flex-start">
        <Button
          variant="subtle"
          color="ink"
          leftSection={<LuArrowLeft size={15} />}
          onClick={() => navigate("/treasuries")}
        >
          Back
        </Button>

        <Stack gap={4}>
          <Title order={2}>{treasury.name}</Title>

          <Text className="caption">
            Confidential treasury secured with Flare Confidential Compute.
          </Text>
        </Stack>
      </Group>

      <Badge size="lg" color="signal" leftSection={<LuShieldCheck size={13} />}>
        TEE Protected
      </Badge>
    </Group>
  );
}
