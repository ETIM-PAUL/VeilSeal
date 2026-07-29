import { useState } from "react";

import { ActionIcon, Badge, Group, Menu, Table, Text } from "@mantine/core";

import { LuEllipsisVertical, LuEye, LuEyeOff, LuExternalLink } from "react-icons/lu";

import { statusColor } from "../../utils/status";

export default function TransferHistory({ transfers }) {
  const [revealed, setRevealed] = useState({});

  return (
    <div className="panel" style={{ padding: 0 }}>
      <Table.ScrollContainer minWidth={900}>
        <Table verticalSpacing="md" horizontalSpacing="lg">
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="label-micro">Recipient</Table.Th>
              <Table.Th className="label-micro">Amount</Table.Th>
              <Table.Th className="label-micro">Token</Table.Th>
              <Table.Th className="label-micro">Status</Table.Th>
              <Table.Th className="label-micro">Time</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {transfers.map((transfer) => {
              const visible = revealed[transfer.id];

              return (
                <Table.Tr key={transfer.id}>
                  <Table.Td>
                    <Text fw={600} className="num">
                      {transfer.recipient}
                    </Text>

                    <Text size="xs" className="ink-faint num">
                      {transfer.txHash}
                    </Text>
                  </Table.Td>

                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Text fw={600} className="num">
                        {visible ? `${transfer.amount} ${transfer.token}` : "••••••"}
                      </Text>

                      <ActionIcon
                        variant="subtle"
                        color="ink"
                        onClick={() =>
                          setRevealed((prev) => ({
                            ...prev,
                            [transfer.id]: !prev[transfer.id],
                          }))
                        }
                      >
                        {visible ? <LuEyeOff size={15} /> : <LuEye size={15} />}
                      </ActionIcon>
                    </Group>
                  </Table.Td>

                  <Table.Td>
                    <Badge variant="outline" color="slate">
                      {transfer.token}
                    </Badge>
                  </Table.Td>

                  <Table.Td>
                    <Badge color={statusColor(transfer.status)}>{transfer.status}</Badge>
                  </Table.Td>

                  <Table.Td>
                    <Text size="sm" className="ink-dim">
                      {transfer.createdAt}
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
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </div>
  );
}
