import {
    Stack,
    Group,
    Title,
    Text,
    Button,
    SimpleGrid
  } from "@mantine/core";
  
  import { LuPlus } from "react-icons/lu";
  
  import TreasuryCard from "../components/treasury/TreasuryCard";
  import { treasuries } from "../data/mockData";
  
  export default function Treasuries() {
    return (
      <Stack gap="xl">
        <Group justify="space-between">
          <div>
            <Title order={2}>Treasuries</Title>
  
            <Text c="dimmed">
              Manage confidential workspaces secured by Flare Confidential Compute.
            </Text>
          </div>
  
          <Button leftSection={<LuPlus />}>
            New Treasury
          </Button>
        </Group>
  
        <SimpleGrid
          cols={{
            base: 1,
            sm: 2,
            xl: 3
          }}
        >
          {treasuries.map((treasury) => (
            <TreasuryCard
              key={treasury.id}
              treasury={treasury}
            />
          ))}
        </SimpleGrid>
      </Stack>
    );
  }