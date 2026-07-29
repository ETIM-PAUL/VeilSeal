import { useState } from "react";

import {
    Modal,
    Stack,
    TextInput,
    NumberInput,
    Select,
    Button,
    Text,
    Group,
    Alert,
    Stepper,
    ThemeIcon,
    Loader
} from "@mantine/core";

import {
    LuCircleCheck,
    LuShieldCheck,
    LuWallet
} from "react-icons/lu";

const TOKENS = [
    "FLR",
    "USDC",
    "ETH"
];

export default function ContributionModal({
    opened,
    onClose
}) {

    const [active, setActive] = useState(0);

    const [amount, setAmount] = useState("");

    const [token, setToken] = useState("FLR");


    const next = () => setActive((v) => v + 1);

    return (

        <Modal
            opened={opened}
            onClose={onClose}
            centered
            size="lg"
            title="New Contribution"
        >

            <Stepper
                active={active}
                allowNextStepsSelect={false}
            >

                <Stepper.Step
                    label="Contribution"
                >

                    <Stack mt="lg">

                        <NumberInput

                            label="Amount"

                            placeholder="100"

                            value={amount}

                            onChange={setAmount}

                            thousandSeparator=","
                        />

                        <Select

                            label="Token"

                            data={TOKENS}

                            value={token}

                            onChange={setToken}

                        />

                        <Button
                            mt="md"
                            onClick={next}
                        >
                            Review
                        </Button>

                    </Stack>

                </Stepper.Step>

                <Stepper.Step
                    label="Review"
                >

                    <Stack mt="lg">

                        <Alert>

                            Please review your contribution before signing.

                        </Alert>

                        <Group justify="space-between">

                            <Text>Amount</Text>

                            <Text fw={700}>
                                {amount} {token}
                            </Text>

                        </Group>

                        <Group justify="space-between">

                            <Text>

                                Confidential Compute

                            </Text>

                            <ThemeIcon
                                color="teal"
                            >
                                <LuShieldCheck/>
                            </ThemeIcon>

                        </Group>

                        <Button
                            onClick={next}
                        >
                            Sign Wallet
                        </Button>

                    </Stack>

                </Stepper.Step>

                <Stepper.Step
                    label="Processing"
                >

                    <Stack
                        align="center"
                        mt="xl"
                    >

                        <Loader/>

                        <Text fw={600}>
                            Waiting for wallet...
                        </Text>

                        <Text
                            size="sm"
                            c="dimmed"
                            ta="center"
                        >

                            In the production version this
                            step will request a wallet signature
                            and submit the contribution to
                            Flare Confidential Compute.

                        </Text>

                        <Button
                            mt="lg"
                            onClick={next}
                        >
                            Simulate Success
                        </Button>

                    </Stack>

                </Stepper.Step>

                <Stepper.Completed>

                    <Stack
                        align="center"
                        py="xl"
                    >

                        <ThemeIcon
                            size={80}
                            color="green"
                            radius="xl"
                        >
                            <LuCircleCheck size={40}/>
                        </ThemeIcon>

                        <Text
                            fw={700}
                            size="xl"
                        >

                            Contribution Submitted

                        </Text>

                        <Text
                            ta="center"
                            c="dimmed"
                        >

                            Your contribution has been submitted.
                            Once the confidential compute workflow
                            finishes, the treasury balance will
                            update automatically.

                        </Text>

                        <Button
                            onClick={onClose}
                        >
                            Close
                        </Button>

                    </Stack>

                </Stepper.Completed>

            </Stepper>

        </Modal>

    );

}