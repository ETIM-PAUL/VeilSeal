import { Group, TextInput, Avatar, Menu, ActionIcon, Burger, Text } from "@mantine/core";

import { LuSearch, LuBell } from "react-icons/lu";

export default function Navbar({ opened, toggle }) {
  return (
    <Group justify="space-between" h="100%" px="md" wrap="nowrap">
      <Group wrap="nowrap">
        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />

        <TextInput
          placeholder="Search VeilPay"
          leftSection={<LuSearch size={15} />}
          w={300}
          styles={{ input: { fontSize: 14 } }}
        />
      </Group>

      <Group gap="sm" wrap="nowrap">
        <ActionIcon variant="subtle" color="ink">
          <LuBell size={17} />
        </ActionIcon>

        <Menu position="bottom-end">
          <Menu.Target>
            <Group gap={8} style={{ cursor: "pointer" }} wrap="nowrap">
              <Avatar radius="sm" size={30} color="signal" variant="light">
                <Text size="xs" fw={700} style={{ fontFamily: "var(--font-display)" }}>
                  P
                </Text>
              </Avatar>

              <Text className="num" size="xs" visibleFrom="sm">
                0x82…91A
              </Text>
            </Group>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item>Profile</Menu.Item>
            <Menu.Item>Wallet</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}
