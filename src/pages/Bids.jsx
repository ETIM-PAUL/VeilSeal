import { Stack, Title, Text } from "@mantine/core";
import { LuGavel } from "react-icons/lu";

import EmptyState from "../components/common/EmptyState";

export default function Bids() {
  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>Closed Bids</Title>

        <Text className="caption" mt={4}>
          Sealed auctions and private tenders.
        </Text>
      </div>

      <div className="panel">
        <EmptyState
          icon={LuGavel}
          title="No closed bids yet"
          description="Sealed bids resolved through Flare Confidential Compute will appear here once auctions close."
        />
      </div>
    </Stack>
  );
}
