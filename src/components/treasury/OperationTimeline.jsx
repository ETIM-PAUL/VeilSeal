import {
    Card,
    Group,
    Stack,
    Text,
    ThemeIcon
} from "@mantine/core";

import {
    LuCheck,
    LuCircle
} from "react-icons/lu";

const steps = [
    "Wallet Signed",
    "Transaction Submitted",
    "Waiting for Relay",
    "Executing in TEE",
    "Attestation Verified",
    "Treasury Updated"
];

export default function OperationTimeline({
    current = 2
}) {

    return (

        <Card
            withBorder
            radius="lg"
        >

            <Stack>

                {
                    steps.map((step,index)=>{

                        const complete=index<current;

                        const active=index===current;

                        return(

                            <Group
                                key={step}
                            >

                                <ThemeIcon
                                    color={
                                        complete
                                        ? "green"
                                        : active
                                        ? "blue"
                                        : "gray"
                                    }
                                    radius="xl"
                                >

                                    {
                                        complete

                                        ?

                                        <LuCheck size={16}/>

                                        :

                                        <LuCircle size={12}/>

                                    }

                                </ThemeIcon>

                                <Text
                                    fw={
                                        active
                                        ?600
                                        :400
                                    }
                                >
                                    {step}
                                </Text>

                            </Group>

                        )

                    })
                }

            </Stack>

        </Card>

    );

}