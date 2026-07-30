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
import { useWallet } from "../../context/useWallet";
import { getVeilBiddingContract, getBrowserSigner, isContractConfigured } from "../../contracts/VeilBidding";
import { computeTermsCommitment, encryptBidTerms, randomNonce, toChainAmount } from "../../utils/sealedBid";
import { fetchLiveTeePublicKey } from "../../lib/tee/ecies";
import { isProxyConfigured } from "../../lib/tee/proxy";

// Static fallback for the self-contained (non-real-registry) contract path —
// the real, registered TEE's public key is fetched live from the extension
// proxy instead, since it's only known once that TEE machine starts up.
const STATIC_TEE_PUBLIC_KEY = import.meta.env.VITE_TEE_PUBLIC_KEY;

export default function PlaceBidDrawer({ opened, onClose, bid, onSubmit }) {
  const { address } = useWallet();

  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState();
  const [token, setToken] = useState(bid?.token ?? "FLR");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

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
    setSubmitError(null);
    onClose();
  };

  const onChain = Boolean(activeBid?.onChainListingId) && isContractConfigured();

  const confirm = async () => {
    const wallet = address ?? MY_WALLET;

    if (!onChain) {
      // Listing predates on-chain wiring (or contract not deployed) — keep
      // the original local-only mock flow for backward compatibility.
      onSubmit({ amount, token, wallet });
      next();
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      let teePublicKey = STATIC_TEE_PUBLIC_KEY;
      if (isProxyConfigured()) {
        teePublicKey = await fetchLiveTeePublicKey();
      }
      if (!teePublicKey) {
        throw new Error("No TEE public key available — set VITE_EXT_PROXY_URL (real TEE) or VITE_TEE_PUBLIC_KEY (demo).");
      }

      const signer = await getBrowserSigner();
      const contract = getVeilBiddingContract(signer);

      const chainAmount = toChainAmount(amount);
      const nonce = randomNonce();
      const termsCommitment = computeTermsCommitment({ amount: chainAmount, nonce, bidder: wallet });
      const encryptedTerms = await encryptBidTerms({ amount: chainAmount, nonce, bidder: wallet }, teePublicKey);

      const tx = await contract.submitSealedBid(activeBid.onChainListingId, termsCommitment, encryptedTerms);
      await tx.wait();

      onSubmit({ amount, token, wallet, termsCommitment, txHash: tx.hash });
      next();
    } catch (err) {
      setSubmitError(err?.reason ?? err?.message ?? "Failed to submit sealed bid on-chain.");
    } finally {
      setSubmitting(false);
    }
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
              {onChain
                ? "This sealed bid will be ECIES-encrypted, committed on-chain, and only revealed by the TEE after the deadline."
                : "This sealed bid will be processed through Flare Confidential Compute and only revealed after the deadline."}
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

            {submitError && (
              <Text size="sm" style={{ color: "var(--danger)" }}>
                {submitError}
              </Text>
            )}

            <Button leftSection={<LuWallet size={15} />} onClick={confirm} loading={submitting}>
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
