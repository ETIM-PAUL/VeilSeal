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
  import { useDisclosure } from "@mantine/hooks";
  import NewTreasuryDrawer from "../components/treasury/NewTreasuryDrawer";

  
  export default function Treasuries() {
      const [opened, { open, close }] =
        useDisclosure(false);

    return (
        <>
        <Stack gap="xl">
            <Group justify="space-between">
            <div>
                <Title order={2}>Treasuries</Title>
    
                <Text className="caption" mt={4}>
                Manage confidential workspaces secured by Flare Confidential Compute.
                </Text>
            </div>

            <Button
        onClick={open}
        leftSection={<LuPlus size={15} />}>
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
        <NewTreasuryDrawer
        opened={opened}
        onClose={close}
        />
        </>
    );
  }