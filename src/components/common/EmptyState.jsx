import { Stack, Title, Text } from "@mantine/core";

export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <Stack align="center" justify="center" py={70} gap={10}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 6,
          border: "1px solid var(--line-strong)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color="var(--ink-dim)" />
      </div>

      <Title order={3}>{title}</Title>

      <Text className="caption" ta="center" maw={360}>
        {description}
      </Text>
    </Stack>
  );
}
