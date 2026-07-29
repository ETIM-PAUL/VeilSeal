import { useMemo, useState } from "react";

import {
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

import {
  LuArrowUpRight,
  LuSearch,
} from "react-icons/lu";

import TransferStats from "../components/transfers/TransferStats";
import TransferHistory from "../components/transfers/TransferHistory";

import {
  transferStats,
  transfers,
} from "../data/transfers";
import { useDisclosure } from "@mantine/hooks";
import NewTransferDrawer from "../components/transfers/NewTransferDrawer";


export default function PrivateTransfers() {
  const [search, setSearch] = useState("");
  const [opened, { open, close }] =
  useDisclosure(false);
  const filtered = useMemo(() => {
    return transfers.filter((item) =>
      item.recipient
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <>
    <Stack gap="xl">

      <Group justify="space-between">

        <div>
          <Title order={2}>
            P2P Private Transfers
          </Title>

          <Text className="caption" mt={4}>
            Send confidential payments powered by Flare Confidential Compute.
          </Text>
        </div>

        <Button
        leftSection={<LuArrowUpRight size={15} />}
        onClick={open}
        >
        New Transfer
        </Button>

      </Group>

      <TransferStats stats={transferStats} />

      <TextInput
        placeholder="Search recipient..."
        value={search}
        onChange={(e) =>
          setSearch(e.currentTarget.value)
        }
        leftSection={<LuSearch size={15} />}
      />

      <TransferHistory transfers={filtered} />

    </Stack>

    <NewTransferDrawer
    opened={opened}
    onClose={close}
    type="p2p"
    />
    </>
  );
}