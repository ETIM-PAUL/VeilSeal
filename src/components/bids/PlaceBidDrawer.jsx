import { useState } from "react";

import {
  Alert,
  Button,
  Divider,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Stepper,
} from "@mantine/core";

import { LuCheckCheck, LuLock, LuShieldCheck, LuWallet } from "react-icons/lu";

import { BID_TOKENS } from "../../utils/bids";
import { MY_WALLET } from "../../data/bids";

export default function PlaceBidDrawer({ opened, onClose, bid, onSubmit }) {
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState();
  const [token, setToken] = useState(bid?.token ?? "FLR");

  // Keep the last known bid around so the drawer content stays in place
  // while it animates closed, instead of vanishing mid-transition.
  const [cachedBid, setCachedBid] = useState(bid);
  if (bid && bid !== cachedBid) {
    setCachedBid(bid);
  }
  const activeBid = bid ?? cachedBid;

  const next = () => setStep((s) => s + 1);

  const reset = () => {
    setAmount(undefined);
    setToken(bid?.token ?? "FLR");
    setStep(0);
    onClose();
  };

  const confirm = () => {
    onSubmit({ amount, token, wallet: MY_WALLET });
    next();
  };

  if (!activeBid) return null;

  return (
    <Drawer opened={opened} onClose={reset} position="right" size="md" title={`Bid on ${activeBid.title}`}>
      <Stepper active={step} allowNextStepsSelect={false}>
        <Stepper.Step label="Amount">
          <Stack mt="xl">
            <Alert icon={<LuLock />} color="slate">
              Your bid amount is sealed and encrypted until the deadline —
              other bidders cannot see it.
            </Alert>

            <NumberInput
              label="Bid Amount"
              placeholder={`${activeBid.minBid}`}
              value={amount}
              onChange={setAmount}
              thousandSeparator=","
              min={activeBid.minBid}
              description={`Minimum bid is ${activeBid.minBid.toLocaleString()} ${activeBid.token}`}
            />

            <Select label="Token" data={BID_TOKENS} value={token} onChange={setToken} />

            <Button mt="md" onClick={next} disabled={!amount || amount < activeBid.minBid}>
              Continue
            </Button>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Review">
          <Stack mt="xl">
            <Alert icon={<LuShieldCheck />}>
              This sealed bid will be processed through Flare Confidential
              Compute and only revealed after the deadline.
            </Alert>

            <Divider />

            <Group justify="space-between">
              <Text c="dimmed">Item</Text>
              <Text fw={600}>{activeBid.title}</Text>
            </Group>

            <Group justify="space-between">
              <Text c="dimmed">Sealed Amount</Text>
              <Text fw={700} className="num">
                {amount?.toLocaleString()} {token}
              </Text>
            </Group>

            <Button leftSection={<LuWallet size={15} />} onClick={confirm}>
              Sign with Wallet
            </Button>
          </Stack>
        </Stepper.Step>

        <Stepper.Completed>
          <Stack mt={50} align="center">
            <LuCheckCheck size={72} color="var(--signal)" />

            <Text fw={700} size="xl">
              Sealed Bid Submitted
            </Text>

            <Text ta="center" c="dimmed">
              Your bid is locked in. It stays hidden until the deadline, when
              the winner is revealed automatically.
            </Text>

            <Button onClick={reset}>Done</Button>
          </Stack>
        </Stepper.Completed>
      </Stepper>
    </Drawer>
  );
}
