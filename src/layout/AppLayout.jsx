import Sidebar from "../components/layout/Sidebar";
import Navbar from "../components/layout/Navbar";


import {
AppShell
} from "@mantine/core";


import {
useDisclosure
} from "@mantine/hooks";


export default function AppLayout({children}){


const [
opened,
{toggle}
]=useDisclosure();



return (

<AppShell


navbar={{
width:260,
breakpoint:"sm",
collapsed:{
mobile:!opened
}
}}


header={{
height:70
}}


padding="md"

>


<AppShell.Navbar>

<Sidebar/>

</AppShell.Navbar>



<AppShell.Header>

<Navbar

opened={opened}

toggle={toggle}

/>

</AppShell.Header>



<AppShell.Main>

{children}

</AppShell.Main>



</AppShell>

)

}