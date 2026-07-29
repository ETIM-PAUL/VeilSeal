import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";

import {
  LuArrowRight,
  LuBuilding2,
  LuCheckCheck,
  LuShieldCheck,
  LuWallet,
} from "react-icons/lu";
import { Grid } from "@mantine/core";
import TreasuryPreview from "./TreasuryPreview";
import { NumberInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";

export default function NewTreasuryDrawer({
  opened,
  onClose,
}) {
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");

  const [description, setDescription] =
    useState("");
  const [targetAmount, setTargetAmount] = useState();
  const [deadline, setDeadline] = useState(null);


  const [acceptFLR, setAcceptFLR] =
    useState(true);

  const [acceptUSDC, setAcceptUSDC] =
    useState(true);

  const [acceptETH, setAcceptETH] =
    useState(false);

  const next = () =>
    setStep((s) => s + 1);

  const reset = () => {
    setStep(0);
    setName("");
    setDescription("");
    setAcceptFLR(true);
    setAcceptUSDC(true);
    setAcceptETH(false);
    onClose();
  };

  return (
    <Drawer
      opened={opened}
      onClose={reset}
      position="right"
      size="xl"
      title="Create Treasury"
    >
      <Stepper
        active={step}
        allowNextStepsSelect={false}
      >
        {/* STEP 1 */}

        <Stepper.Step label="Details">
  <Grid mt="lg">

    {/* LEFT COLUMN - FORM */}

    <Grid.Col span={{ base: 12, md: 7 }}>

      <Stack>

        <TextInput
          label="Treasury Name"
          placeholder="Engineering DAO"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

<Textarea
          label="Description"
          placeholder="Briefly describe the purpose of this treasury..."
          minRows={4}
          autosize
          value={description}
          onChange={(e) =>
            setDescription(e.currentTarget.value)
          }
        />

<NumberInput
  label="Target Amount"
  placeholder="10000"
  value={targetAmount}
  onChange={setTargetAmount}
  thousandSeparator=","
  decimalScale={2}
  fixedDecimalScale={false}
  suffix=" FLR"
  min={0}
  description="Funding goal for this treasury"
/>

<DateInput
  label="Deadline"
  placeholder="Select deadline"
  value={deadline}
  onChange={setDeadline}
  clearable
  minDate={new Date()}
  description="Treasury closes after this date"
/>


        <Button
          mt="md"
          size="md"
          rightSection={<LuArrowRight />}
          onClick={next}
          disabled={
            !name.trim() ||
            (!acceptFLR &&
              !acceptUSDC &&
              !acceptETH)
          }
        >
          Review Treasury
        </Button>

      </Stack>

    </Grid.Col>

    {/* RIGHT COLUMN - LIVE PREVIEW */}

    <Grid.Col span={{ base: 12, md: 5 }}>

      <TreasuryPreview
        name={name}
        deadline={deadline}
        targetAmount={targetAmount}
      />

    </Grid.Col>

  </Grid>
</Stepper.Step>

        {/* STEP 2 */}

        <Stepper.Step label="Review">
          <Stack mt="xl">

            <Alert
              icon={<LuShieldCheck />}
            >
              This treasury will be
              deployed and managed
              through your connected
              wallet.
            </Alert>

            <Divider />

            <Group justify="space-between">
              <Text c="dimmed">
                Name
              </Text>

              <Text fw={600}>
                {name}
              </Text>
            </Group>

            <Box>
              <Text
                size="sm"
                c="dimmed"
                mb={6}
              >
                Description
              </Text>

              <Text>
                {description ||
                  "No description"}
              </Text>
            </Box>

            <Group justify="space-between">

            <Text c="dimmed">
                Target Amount
            </Text>

            <Text fw={600} className="num">
                {targetAmount
                ? `${targetAmount.toLocaleString()} FLR`
                : "No target"}
            </Text>

            </Group>

            <Group justify="space-between">

            <Text c="dimmed">
                Deadline
            </Text>

            <Text fw={600}>
                {deadline
                ? new Date(deadline).toLocaleDateString()
                : "No deadline"}
            </Text>

            </Group>

            <Button
              leftSection={<LuWallet />}
              onClick={next}
            >
              Create Treasury
            </Button>

          </Stack>
        </Stepper.Step>

        {/* STEP 3 */}

        <Stepper.Step label="Sign">
          <Stack
            mt={60}
            align="center"
          >

            <LuWallet size={56} />

            <Text
              fw={700}
              size="lg"
            >
              Awaiting Wallet Signature
            </Text>

            <Text
              ta="center"
              c="dimmed"
            >
              Confirm the transaction
              in your wallet to deploy
              your treasury.
            </Text>

            <Button
              mt="lg"
              onClick={next}
            >
              Simulate Signature
            </Button>

          </Stack>
        </Stepper.Step>

        {/* STEP 4 */}

        <Stepper.Completed>

          <Stack
            mt={60}
            align="center"
          >

            <LuCheckCheck
              size={72}
              color="var(--signal)"
            />

            <Text
              fw={700}
              size="xl"
            >
              Treasury Created
            </Text>

            <Text
              ta="center"
              c="dimmed"
            >
              Your treasury has been
              created successfully.
            </Text>

            <Button
              onClick={reset}
              leftSection={
                <LuBuilding2 />
              }
            >
              Go to Treasury
            </Button>

          </Stack>

        </Stepper.Completed>

      </Stepper>
    </Drawer>
  );
}