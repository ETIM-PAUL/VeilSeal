import { useState } from "react";

import {
  ActionIcon,
  Badge,
  Group,
  Menu,
  Table,
  Text,
} from "@mantine/core";

import {
  LuEllipsisVertical,
  LuEye,
  LuEyeOff,
  LuExternalLink,
} from "react-icons/lu";

const colours = {
  Queued: "yellow",
  Executing: "violet",
  Attested: "teal",
  Settled: "green",
  Failed: "red",
};

export default function TransferHistory({ transfers }) {
  const [revealed, setRevealed] = useState({});

  return (
    <Table.ScrollContainer minWidth={900}>
      <Table highlightOnHover verticalSpacing="md">

        <Table.Thead>
          <Table.Tr>
            <Table.Th>Recipient</Table.Th>
            <Table.Th>Amount</Table.Th>
            <Table.Th>Token</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Time</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>

          {transfers.map((transfer) => {

            const visible = revealed[transfer.id];

            return (
              <Table.Tr key={transfer.id}>

                <Table.Td>

                  <Text fw={600}>
                    {transfer.recipient}
                  </Text>

                  <Text size="xs" c="dimmed">
                    {transfer.txHash}
                  </Text>

                </Table.Td>

                <Table.Td>

                  <Group gap={6}>

                    <Text fw={600}>
                      {visible
                        ? `${transfer.amount} ${transfer.token}`
                        : "••••••"}
                    </Text>

                    <ActionIcon
                      variant="subtle"
                      onClick={() =>
                        setRevealed((prev) => ({
                          ...prev,
                          [transfer.id]: !prev[transfer.id],
                        }))
                      }
                    >
                      {visible ? (
                        <LuEyeOff size={16} />
                      ) : (
                        <LuEye size={16} />
                      )}
                    </ActionIcon>

                  </Group>

                </Table.Td>

                <Table.Td>
                  {transfer.token}
                </Table.Td>

                <Table.Td>

                  <Badge color={colours[transfer.status]}>
                    {transfer.status}
                  </Badge>

                </Table.Td>

                <Table.Td>
                  {transfer.createdAt}
                </Table.Td>

                <Table.Td>

                  <Menu>

                    <Menu.Target>

                      <ActionIcon variant="subtle">
                        <LuEllipsisVertical />
                      </ActionIcon>

                    </Menu.Target>

                    <Menu.Dropdown>

                      <Menu.Item
                        leftSection={<LuExternalLink size={16} />}
                      >
                        View Transaction
                      </Menu.Item>

                    </Menu.Dropdown>

                  </Menu>

                </Table.Td>

              </Table.Tr>
            );
          })}

        </Table.Tbody>

      </Table>
    </Table.ScrollContainer>
  );
}