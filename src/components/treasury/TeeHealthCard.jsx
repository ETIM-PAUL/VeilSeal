import {
    Card,
    Stack,
    Group,
    Badge,
    Text,
    Divider
    } from "@mantine/core";
    
    export default function TeeHealthCard(){
    
    return(
    
    <Card
    withBorder
    radius="lg"
    >
    
    <Stack>
    
    <Group justify="space-between">
    
    <Text fw={700}>
    TEE Health
    </Text>
    
    <Badge color="green">
    
    Healthy
    
    </Badge>
    
    </Group>
    
    <Divider/>
    
    <Group justify="space-between">
    
    <Text size="sm">
    
    Pending Jobs
    
    </Text>
    
    <Text fw={600}>
    4
    </Text>
    
    </Group>
    
    <Group justify="space-between">
    
    <Text size="sm">
    
    Average Execution
    
    </Text>
    
    <Text fw={600}>
    2.3 s
    </Text>
    
    </Group>
    
    <Group justify="space-between">
    
    <Text size="sm">
    
    Last Attestation
    
    </Text>
    
    <Text fw={600}>
    2 mins ago
    </Text>
    
    </Group>
    
    </Stack>
    
    </Card>
    
    )
    
    }