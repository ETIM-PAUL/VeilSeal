import {

    Group,
    TextInput,
    Avatar,
    Menu,
    ActionIcon
    
    } from "@mantine/core";
    
    
    import {
    
    LuSearch,
    LuBell
    
    } from "react-icons/lu";
    
    
    export default function Navbar(){
    
    
    return (
    
    <Group
    
    justify="space-between"
    
    h="100%"
    
    px="md"
    
    >
    
    
    <TextInput
    
    placeholder="Search VeilPay"
    
    leftSection={<LuSearch/>}
    
    w={320}
    
    />
    
    
    
    <Group>
    
    
    <ActionIcon
    
    variant="subtle"
    
    >
    
    <LuBell/>
    
    </ActionIcon>
    
    
    
    <Menu>
    
    
    <Menu.Target>
    
    <Avatar
    
    radius="xl"
    
    color="blue"
    
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