import {

    Badge,
    Group
    
    } from "@mantine/core";
    
    
    import {
    LuWallet
    } from "react-icons/lu";
    
    
    export default function WalletBadge(){
    
    
    return (
    
    <Badge
    
    variant="light"
    
    leftSection={<LuWallet size={14}/>}
    
    >
    
    0x82...91A
    
    </Badge>
    
    )
    
    }