import {

    Stack,
    ThemeIcon,
    Title,
    Text
    
    } from "@mantine/core";
    
    
    export default function EmptyState({
    
    icon:Icon,
    title,
    description
    
    }){
    
    
    return (
    
    <Stack
    
    align="center"
    
    justify="center"
    
    py={60}
    
    >
    
    
    <ThemeIcon
    
    size={60}
    
    radius="xl"
    
    variant="light"
    
    >
    
    <Icon size={28}/>
    
    </ThemeIcon>
    
    
    
    <Title order={3}>
    
    {title}
    
    </Title>
    
    
    
    <Text
    
    c="dimmed"
    
    >
    
    {description}
    
    </Text>
    
    
    
    </Stack>
    
    )
    
    }