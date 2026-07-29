import { Badge, Table, Text } from "@mantine/core";

import { statusColor } from "../../utils/status";

export default function OperationsTable({ operations, onOpen }) {
  return (
    <div className="panel" style={{ padding: 0 }}>
      <Table.ScrollContainer minWidth={800}>
        <Table verticalSpacing="md" horizontalSpacing="lg">
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="label-micro">Type</Table.Th>
              <Table.Th className="label-micro">Party</Table.Th>
              <Table.Th className="label-micro">Amount</Table.Th>
              <Table.Th className="label-micro">Token</Table.Th>
              <Table.Th className="label-micro">Status</Table.Th>
              <Table.Th className="label-micro">Time</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {operations.map((op) => (
              <Table.Tr key={op.id} style={{ cursor: "pointer" }} onClick={() => onOpen(op.id)}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {op.type}
                  </Text>
                </Table.Td>

                <Table.Td>
                  <Text size="sm" fw={600}>
                    {op.party}
                  </Text>

                  <Text size="xs" className="ink-faint num">
                    {op.wallet}
                  </Text>
                </Table.Td>

                <Table.Td>
                  <Text fw={600} className="num">
                    {op.amount}
                  </Text>
                </Table.Td>

                <Table.Td>
                  <Badge variant="outline" color="slate">
                    {op.token}
                  </Badge>
                </Table.Td>

                <Table.Td>
                  <Badge color={statusColor(op.status)}>{op.status}</Badge>
                </Table.Td>

                <Table.Td>
                  <Text size="sm" className="ink-dim">
                    {op.time}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </div>
  );
}
