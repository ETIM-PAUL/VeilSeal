import {
    Group,
    TextInput,
    Avatar,
    Menu,
    ActionIcon,
    Burger
    } from "@mantine/core";
    
    
    import {
    LuSearch,
    LuBell
    } from "react-icons/lu";
    
    
    import {
    useDisclosure
    } from "@mantine/hooks";
    
    
    export default function Navbar({opened, toggle}){
    
    
    return (
    
    <Group
    
    justify="space-between"
    
    h="100%"
    
    px="md"
    
    >
    
    
    <Group>
    
    
    <Burger
    
    opened={opened}
    
    onClick={toggle}
    
    hiddenFrom="sm"
    
    />
    
    
    <TextInput
    
    placeholder="Search VeilPay"
    
    leftSection={<LuSearch/>}
    
    w={300}
    
    />
    
    
    </Group>
    
    
    
    <Group>
    
    
    <ActionIcon variant="subtle">
    
    <LuBell/>
    
    </ActionIcon>
    
    
    
    <Menu>
    
    
    <Menu.Target>
    
    <Avatar
    
    color="blue"
    
    radius="xl"
    
    >
    
    P
    
    </Avatar>
    
    
    </Menu.Target>
    
    
    <Menu.Dropdown>
    
    <Menu.Item>
    Profile
    </Menu.Item>
    
    <Menu.Item>
    Wallet
    </Menu.Item>
    
    </Menu.Dropdown>
    
    
    </Menu>
    
    
    </Group>
    
    
    </Group>
    
    )
    
    }