import {

    Card,
    Stack,
    Group,
    Text,
    Badge
    
    } from "@mantine/core";
    
    
    import {
    mockActivity
    } from "../../data/mockData";
    
    
    export default function ActivityFeed(){
    
    
    return (
    
    <Card
    
    shadow="sm"
    
    radius="lg"
    
    withBorder
    
    p="lg"
    
    >
    
    
    <Text
    
    fw={600}
    
    mb="md"
    
    >
    
    Recent Activity
    
    </Text>
    
    
    
    <Stack gap="md">
    
    
    {
    mockActivity.map((item)=>
    
    
    <Group
    
    key={item.id}
    
    justify="space-between"
    
    >
    
    
    <div>
    
    <Text size="sm" fw={500}>
    
    {item.title}
    
    </Text>
    
    
    <Text size="xs" c="dimmed">
    
    {item.time}
    
    </Text>
    
    </div>
    
    
    
    <Badge
    
    color={
    item.status==="Completed"
    ?
    "green"
    :
    "yellow"
    }
    
    variant="light"
    
    >
    
    {item.status}
    
    </Badge>
    
    
    </Group>
    
    
    )
    
    }
    
    
    
    </Stack>
    
    
    
    </Card>
    
    )
    
    }