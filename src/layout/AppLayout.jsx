import Sidebar from "../components/layout/Sidebar";
import Navbar from "../components/layout/Navbar";

import {
  AppShell
} from "@mantine/core";


export default function AppLayout({
children
}) {


return (

<AppShell

navbar={{
 width:260,
 breakpoint:"sm"
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

<Navbar/>

</AppShell.Header>



<AppShell.Main>

{children}

</AppShell.Main>


</AppShell>

)

}