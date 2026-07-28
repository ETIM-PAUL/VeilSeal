import {

    SimpleGrid,
    Grid,
    Stack,
    Title,
    Text,
    Button,
    Group
    
    } from "@mantine/core";
    
    
    import {
    
    LuWallet,
    LuArrowLeftRight,
    LuGavel,
    LuUsers,
    LuPlus
    
    } from "react-icons/lu";
    
    
    import StatCard from "../components/dashboard/StatCard";
    
    import ActivityFeed from "../components/dashboard/ActivityFeed";
    
    import {
    dashboardStats
    } from "../data/mockData";
    
    
    
    const icons=[
    
    LuWallet,
    LuArrowLeftRight,
    LuGavel,
    LuUsers
    
    ];
    
    
    
    export default function Dashboard(){
    
    
    return (
    
    <Stack gap="xl">
    
    
    <Group justify="space-between">
    
    
    <div>
    
    <Title order={2}>
    
    Good afternoon
    
    </Title>
    
    
    <Text c="dimmed">
Private payments, treasury management, and sealed bidding powered by Flare Confidential Compute.
</Text>
    
    
    </div>
    
    
    
    <Button
    
    leftSection={<LuPlus/>}
    
    radius="md"
    
    >
    
    New Transaction
    
    </Button>
    
    
    </Group>
    
    
    
    
    <SimpleGrid
    
    cols={{
    base:1,
    sm:2,
    lg:4
    }}
    
    >
    
    
    {
    dashboardStats.map((stat,index)=>(
    
    
    <StatCard
    
    key={stat.title}
    
    title={stat.title}
    
    value={stat.value}
    
    description={stat.description}
    
    icon={icons[index]}
    
    />
    
    
    ))
    
    }
    
    
    </SimpleGrid>
    
    
    
    
    
    <Grid>
    
    
    <Grid.Col
    
    span={{
    base:12,
    md:8
    }}
    
    >
    
    
    <ActivityFeed/>
    
    
    </Grid.Col>
    
    
    
    <Grid.Col
    
    span={{
    base:12,
    md:4
    }}
    
    >
    
    
    <Stack>
    
    
    <Button
    
    size="lg"
    
    radius="md"
    
    leftSection={<LuWallet/>}
    
    >
    
    New Treasury
    
    </Button>
    
    
    
    <Button
    
    size="lg"
    
    radius="md"
    
    variant="light"
    
    leftSection={<LuArrowLeftRight/>}
    
    >
    
    Private Transfer
    
    </Button>
    
    
    
    <Button
    
    size="lg"
    
    radius="md"
    
    variant="light"
    
    leftSection={<LuGavel/>}
    
    >
    
    New Sealed Bid
    
    </Button>
    
    
    </Stack>
    
    
    </Grid.Col>
    
    
    </Grid>
    
    
    
    </Stack>
    
    )
    
    }