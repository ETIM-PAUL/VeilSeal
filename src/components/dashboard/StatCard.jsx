import {
    Card,
    Group,
    Text,
    ThemeIcon
  } from "@mantine/core";
  
  
  export default function StatCard({
    title,
    value,
    icon: Icon,
    description
  }) {
  
  
  return (
  
  <Card
    shadow="sm"
    radius="lg"
    withBorder
    p="lg"
  >
  
  
  <Group justify="space-between">
  
  
  <div>
  
  <Text
   size="sm"
   c="dimmed"
  >
  
  {title}
  
  </Text>
  
  
  <Text
   size="xl"
   fw={700}
   mt={5}
  >
  
  {value}
  
  </Text>
  
  
  <Text
   size="xs"
   c="dimmed"
   mt={4}
  >
  
  {description}
  
  </Text>
  
  
  </div>
  
  
  
  <ThemeIcon
  
  size={45}
  
  radius="md"
  
  variant="light"
  
  >
  
  <Icon size={22}/>
  
  </ThemeIcon>
  
  
  
  </Group>
  
  
  </Card>
  
  )
  
  }