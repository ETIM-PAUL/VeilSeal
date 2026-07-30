import { Button, Group, Skeleton, Stack } from "@mantine/core";
import { LuArrowLeft } from "react-icons/lu";
import { useNavigate } from "react-router-dom";

export default function TreasuryHeaderSkeleton() {
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

        <Stack gap={6}>
          <Skeleton height={20} width={180} />
          <Skeleton height={10} width={260} />
        </Stack>
      </Group>

      <Skeleton height={26} width={130} radius="xl" />
    </Group>
  );
}
