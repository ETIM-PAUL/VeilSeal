import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";

import {
  LuArrowUpRight,
  LuEllipsisVertical,
  LuExternalLink,
  LuSearch,
  LuFilter,
} from "react-icons/lu";
import { useDisclosure } from "@mantine/hooks";

import NewTransferDrawer from "../transfers/NewTransferDrawer";
import { statusColor } from "../../utils/status";

export default function TreasuryContributions({ contributions = [] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const [opened, { open, close }] = useDisclosure(false);

  const filtered = useMemo(() => {
    return contributions.filter((item) => {
      const matchesStatus = status === "All" || item.status === status;

      const value = `${item.wallet} ${item.token}`.toLowerCase();

      const matchesSearch = value.includes(search.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [search, status, contributions]);

  return (
    <>
      <Stack gap="lg">
        <Group justify="space-between">
          <Group>
            <TextInput
              placeholder="Search wallet..."
              leftSection={<LuSearch size={15} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              w={260}
            />

            <Select
              leftSection={<LuFilter size={14} />}
              value={status}
              onChange={(value) => setStatus(value || "All")}
              data={["All", "Queued", "Relayed", "Executing", "Attested", "Settled", "Failed"]}
              w={180}
            />
          </Group>

          <Button leftSection={<LuArrowUpRight size={15} />} onClick={open}>
            New Contribution
          </Button>
        </Group>

        <div className="panel" style={{ padding: 0 }}>
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="md" horizontalSpacing="lg">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th className="label-micro">Contributor</Table.Th>
                  <Table.Th className="label-micro">Amount</Table.Th>
                  <Table.Th className="label-micro">Token</Table.Th>
                  <Table.Th className="label-micro">Status</Table.Th>
                  <Table.Th className="label-micro">Time</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {filtered.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Text size="sm" fw={600} className="num">
                        {item.wallet}
                      </Text>

                      <Text size="xs" className="ink-faint num">
                        {item.txHash}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Text fw={600} className="num">
                        {item.amount}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Badge variant="outline" color="slate">
                        {item.token}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      <Badge color={statusColor(item.status)}>{item.status}</Badge>
                    </Table.Td>

                    <Table.Td>
                      <Text size="sm" className="ink-dim">
                        {item.time}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="ink">
                            <LuEllipsisVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>

                        <Menu.Dropdown>
                          <Menu.Item leftSection={<LuExternalLink size={14} />}>
                            View Transaction
                          </Menu.Item>

                          <Menu.Item>View Attestation</Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </div>
      </Stack>

      <NewTransferDrawer opened={opened} onClose={close} type="treasury" />
    </>
  );
}
