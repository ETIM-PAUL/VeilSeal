import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Avatar,
} from "@mantine/core";

import {
  LuArrowUpRight,
  LuEllipsisVertical,
  LuExternalLink,
  LuSearch,
  LuWallet,
  LuFilter,
} from "react-icons/lu";
import { useDisclosure } from "@mantine/hooks";

import NewTransferDrawer from "../transfers/NewTransferDrawer";



const statusColour = {
  Queued: "yellow",
  Relayed: "blue",
  Executing: "violet",
  Attested: "teal",
  Settled: "green",
  Failed: "red",
};

export default function TreasuryContributions({
  contributions = [],
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const [
    opened,
    {
        open,
        close
    }
  ] = useDisclosure(false);

  const filtered = useMemo(() => {
    return contributions.filter((item) => {
      const matchesStatus =
        status === "All" || item.status === status;

      const value = `${item.wallet} ${item.token}`.toLowerCase();

      const matchesSearch = value.includes(
        search.toLowerCase()
      );

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
            leftSection={<LuSearch size={16} />}
            value={search}
            onChange={(e) =>
              setSearch(e.currentTarget.value)
            }
            w={260}
          />

          <Select
            leftSection={<LuFilter size={15} />}
            value={status}
            onChange={(value) => setStatus(value || "All")}
            data={[
              "All",
              "Queued",
              "Relayed",
              "Executing",
              "Attested",
              "Settled",
              "Failed",
            ]}
            w={180}
          />

        </Group>

        <Button
          leftSection={<LuArrowUpRight />}
          onClick={open}
        >
            New Contribution
        </Button>

      </Group>

      <Card
        withBorder
        radius="lg"
        p={0}
      >
        <Table.ScrollContainer minWidth={950}>
          <Table
            striped
            highlightOnHover
            verticalSpacing="md"
          >
            <Table.Thead>

              <Table.Tr>

                <Table.Th>Contributor</Table.Th>

                <Table.Th>Amount</Table.Th>

                <Table.Th>Token</Table.Th>

                <Table.Th>Status</Table.Th>

                <Table.Th>Time</Table.Th>

                <Table.Th></Table.Th>

              </Table.Tr>

            </Table.Thead>

            <Table.Tbody>

              {filtered.map((item) => (
                <Table.Tr key={item.id}>

                  <Table.Td>

                    <Group>

                      <Avatar
                        radius="xl"
                        color="blue"
                      >
                        <LuWallet size={16} />
                      </Avatar>

                      <div>

                        <Text fw={600}>
                          {item.wallet}
                        </Text>

                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          {item.txHash}
                        </Text>

                      </div>

                    </Group>

                  </Table.Td>

                  <Table.Td>

                    <Text fw={600}>
                      {item.amount}
                    </Text>

                  </Table.Td>

                  <Table.Td>

                    <Badge
                      variant="light"
                    >
                      {item.token}
                    </Badge>

                  </Table.Td>

                  <Table.Td>

                    <Badge
                      color={
                        statusColour[item.status]
                      }
                    >
                      {item.status}
                    </Badge>

                  </Table.Td>

                  <Table.Td>

                    <Text size="sm">
                      {item.time}
                    </Text>

                  </Table.Td>

                  <Table.Td>

                    <Menu>

                      <Menu.Target>

                        <Button
                          variant="subtle"
                          px={6}
                        >
                          <LuEllipsisVertical />
                        </Button>

                      </Menu.Target>

                      <Menu.Dropdown>

                        <Menu.Item
                          leftSection={
                            <LuExternalLink />
                          }
                        >
                          View Transaction
                        </Menu.Item>

                        <Menu.Item>
                          View Attestation
                        </Menu.Item>

                      </Menu.Dropdown>

                    </Menu>

                  </Table.Td>

                </Table.Tr>
              ))}

            </Table.Tbody>

          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
    
    <NewTransferDrawer
    opened={opened}
    onClose={close}
    type="treasury"
    />
    </>
  );

  
}

