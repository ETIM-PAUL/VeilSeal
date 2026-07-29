import { useState } from "react";
import {
  Button,
  Divider,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Stepper,
  Text,
  TextInput,
  Alert,
  Badge,
} from "@mantine/core";

import {
  LuArrowRight,
  LuCheckCheck,
  LuShieldCheck,
  LuWallet
} from "react-icons/lu";

const TOKENS = [
  { value: "FLR", label: "FLR" },
  { value: "USDC", label: "USDC" },
  { value: "ETH", label: "ETH" },
];

export default function NewTransferDrawer({
  opened,
  onClose,
  type,
}) {
  const [step, setStep] = useState(0);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("FLR");
  const [memo, setMemo] = useState("");

  const next = () => setStep((s) => s + 1);

  const reset = () => {
    setRecipient("");
    setAmount("");
    setToken("FLR");
    setMemo("");
    setStep(0);
    onClose();
  };

  return (
    <Drawer
      opened={opened}
      onClose={reset}
      position="right"
      size="md"
      title="New Private Transfer"
    >
      <Stepper
        active={step}
        allowNextStepsSelect={false}
      >
        {/* STEP 1 */}

        <Stepper.Step
          label="Transfer"
        >
          <Stack mt="xl">

            <TextInput
              label="Recipient Wallet"
              placeholder="0x..."
              value={recipient}
              disabled={type === "treasury"}
              onChange={(e) =>
                setRecipient(e.currentTarget.value)
              }
            />

            <Select
              label="Token"
              data={TOKENS}
              value={token}
              onChange={(v) => setToken(v)}
            />

            <NumberInput
              label="Amount"
              placeholder="100"
              value={amount}
              onChange={setAmount}
            />

            <TextInput
              label="Encrypted Memo"
              placeholder="Optional"
              value={memo}
              onChange={(e) =>
                setMemo(e.currentTarget.value)
              }
            />

            <div className="panel" style={{ padding: 14 }}>
              <Group justify="space-between">
                <Text size="sm" className="ink-dim">
                  Estimated Fee
                </Text>

                <Text fw={600} className="num">
                  0.02 FLR
                </Text>
              </Group>

              <Group
                justify="space-between"
                mt="xs"
              >
                <Text size="sm" className="ink-dim">
                  Network
                </Text>

                <Badge variant="outline" color="slate">
                  Coston2
                </Badge>
              </Group>
            </div>

            <Button
              rightSection={<LuArrowRight />}
              onClick={next}
            >
              Continue
            </Button>

          </Stack>
        </Stepper.Step>

        {/* STEP 2 */}

        <Stepper.Step
          label="Review"
        >
          <Stack mt="xl">

            <Alert
              icon={<LuShieldCheck />}
            >
              This transfer will be
              processed through
              Flare Confidential Compute.
            </Alert>

            <Divider />

            <Group justify="space-between">
              <Text c="dimmed">
                Recipient
              </Text>

              <Text fw={600}>
                {recipient}
              </Text>
            </Group>

            <Group justify="space-between">
              <Text c="dimmed">
                Amount
              </Text>

              <Text fw={700} className="num">
                {amount} {token}
              </Text>
            </Group>

            <Group justify="space-between">
              <Text c="dimmed">
                Memo
              </Text>

              <Text>
                {memo || "None"}
              </Text>
            </Group>

            <Button
              leftSection={<LuWallet />}
              onClick={next}
            >
              Sign with Wallet
            </Button>

          </Stack>
        </Stepper.Step>

        {/* STEP 3 */}

        <Stepper.Step
          label="Signing"
        >
          <Stack
            align="center"
            mt={50}
          >
            <LuWallet size={56} />

            <Text fw={700}>
              Awaiting Wallet Signature
            </Text>

            <Text
              ta="center"
              c="dimmed"
            >
              Your wallet will ask you
              to sign this confidential
              transfer before it is sent.
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
            align="center"
            mt={50}
          >
            <LuCheckCheck
              size={72}
              color="var(--signal)"
            />

            <Text
              fw={700}
              size="xl"
            >
              Transfer Submitted
            </Text>

            <Text
              ta="center"
              c="dimmed"
            >
              Your confidential transfer
              has been submitted and is
              waiting to be processed.
            </Text>

            <Button
              onClick={reset}
            >
              Done
            </Button>

          </Stack>

        </Stepper.Completed>

      </Stepper>
    </Drawer>
  );
}