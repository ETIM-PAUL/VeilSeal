import { Group, Skeleton, Table } from "@mantine/core";

export default function TransferHistorySkeleton({ rows = 6 }) {
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
            {Array.from({ length: rows }).map((_, i) => (
              <Table.Tr key={i}>
                <Table.Td>
                  <Skeleton height={12} width={110} />
                  <Skeleton height={9} width={80} mt={6} />
                </Table.Td>

                <Table.Td>
                  <Group gap={6} wrap="nowrap">
                    <Skeleton height={12} width={70} />
                  </Group>
                </Table.Td>

                <Table.Td>
                  <Skeleton height={18} width={48} radius="xl" />
                </Table.Td>

                <Table.Td>
                  <Skeleton height={18} width={64} radius="xl" />
                </Table.Td>

                <Table.Td>
                  <Skeleton height={12} width={60} />
                </Table.Td>

                <Table.Td>
                  <Skeleton height={16} width={16} circle />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </div>
  );
}
