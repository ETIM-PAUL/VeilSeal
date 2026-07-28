import {
    Card,
    Stack,
    Text,
    Progress,
    Group
} from "@mantine/core";

export default function VaultSummary() {

    return (

        <Card withBorder radius="lg">

            <Stack>

                <Text fw={700}>
                    Vault Allocation
                </Text>

                <div>

                    <Group justify="space-between">
                        <Text size="sm">Available</Text>
                        <Text size="sm">68%</Text>
                    </Group>

                    <Progress value={68} mt={6}/>
                </div>

                <div>

                    <Group justify="space-between">
                        <Text size="sm">Reserved</Text>
                        <Text size="sm">22%</Text>
                    </Group>

                    <Progress
                        value={22}
                        color="orange"
                        mt={6}
                    />

                </div>

                <div>

                    <Group justify="space-between">
                        <Text size="sm">Pending Settlement</Text>
                        <Text size="sm">10%</Text>
                    </Group>

                    <Progress
                        value={10}
                        color="violet"
                        mt={6}
                    />

                </div>

            </Stack>

        </Card>

    );

}