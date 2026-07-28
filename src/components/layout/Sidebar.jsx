import {

    Stack,
    Text,
    Group,
    ThemeIcon
    
    } from "@mantine/core";
    
    
    import {
    
    LuLayoutDashboard,
    LuWallet,
    LuArrowLeftRight,
    LuGavel,
    LuActivity,
    LuSettings,
    LuShieldCheck
    
    } from "react-icons/lu";
    
    
    import {
    NavLink
    } from "react-router-dom";
    
    
    const links=[
    
    {
    name:"Dashboard",
    path:"/",
    icon:LuLayoutDashboard
    },
    
    {
    name:"Treasury",
    path:"/treasury",
    icon:LuWallet
    },
    
    {
    name:"Transfers",
    path:"/transfers",
    icon:LuArrowLeftRight
    },
    
    {
    name:"Closed Bids",
    path:"/bids",
    icon:LuGavel
    },
    
    {
    name:"Activity",
    path:"/activity",
    icon:LuActivity
    },
    
    {
    name:"Settings",
    path:"/settings",
    icon:LuSettings
    }
    
    ];
    
    
    export default function Sidebar(){
    
    
    return (
    
    <Stack p="md">
    
    
    <Group mb="xl">
    
    
    <ThemeIcon
    size="42"
    radius="md"
    >
    
    <LuShieldCheck/>
    
    </ThemeIcon>
    
    
    <div>
    
    <Text fw={700}>
    VeilPay
    </Text>
    
    <Text size="xs" c="dimmed">
    Confidential Finance
    </Text>
    
    </div>
    
    
    </Group>
    
    
    
    <Stack gap="xs">
    
    
    {
    links.map((item)=>{
    
    
    const Icon=item.icon;
    
    
    return (
    
    <NavLink
    
    key={item.path}
    
    to={item.path}
    
    style={{
    textDecoration:"none"
    }}
    
    >
    
    
    <Group
    
    p="sm"
    
    style={{
    
    borderRadius:12
    
    }}
    
    className="hover:bg-gray-100"
    
    >
    
    
    <Icon size={18}/>
    
    
    <Text size="sm">
    
    {item.name}
    
    </Text>
    
    
    </Group>
    
    
    </NavLink>
    
    
    )
    
    
    })
    
    }
    
    
    
    </Stack>
    
    
    
    </Stack>
    
    
    )
    
    }