import {
    Drawer,
    Stack,
    Badge,
    Text,
    Group
} from "@mantine/core";

import OperationTimeline from "./OperationTimeline";

export default function OperationDrawer({

opened,

close

}){

return(

<Drawer

opened={opened}

onClose={close}

title="Confidential Operation"

position="right"

size="md"

>

<Stack>

<Group justify="space-between">

<Text fw={700}>
Contribution
</Text>

<Badge color="violet">
Executing
</Badge>

</Group>

<Text size="sm" c="dimmed">

Amount

</Text>

<Text fw={700}>
500 FLR
</Text>

<OperationTimeline current={2}/>

</Stack>

</Drawer>

)

}