import { useState } from "react";

import { Alert, Button, Divider, Drawer, Group, Stack, Stepper, Text } from "@mantine/core";
import { LuCheckCheck, LuLock, LuWallet } from "react-icons/lu";

import { useWallet } from "../../context/useWallet";
import { getVeilBiddingContract, getBrowserSigner, isContractConfigured } from "../../contracts/VeilBidding";
import { computeCipherGuessCommitment, encryptCipherGuess, randomNonce } from "../../utils/sealedBid";
import { fetchLiveTeePublicKey } from "../../lib/tee/ecies";
import { isProxyConfigured } from "../../lib/tee/proxy";
import WordArrangementInput from "./WordArrangementInput";

// Static fallback for the self-contained (non-real-registry) contract path -
// see PlaceBidDrawer.jsx for the same pattern applied to sealed bids.
const STATIC_TEE_PUBLIC_KEY = import.meta.env.VITE_TEE_PUBLIC_KEY;

export default function SubmitGuessDrawer({ opened, onClose, listing, onSubmit }) {
  const { address } = useWallet();

  const [step, setStep] = useState(0);
  const [arrangement, setArrangement] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitStepLabel, setSubmitStepLabel] = useState("");

  // Keep the last known listing around so the drawer content stays in place
  // while it animates closed, instead of vanishing mid-transition.
  const [cachedListing, setCachedListing] = useState(listing);
  if (listing && listing !== cachedListing) {
    setCachedListing(listing);
  }
  const activeListing = listing ?? cachedListing;

  // Reset the guess to identity order whenever a different listing opens -
  // adjusted directly in render (same pattern as cachedListing above) rather
  // than in an effect, so it can't cause a cascading extra render.
  const [arrangementFor, setArrangementFor] = useState(null);
  if (activeListing && activeListing.onChainListingId !== arrangementFor) {
    setArrangement(Array.from({ length: activeListing.wordCount }, (_, i) => i));
    setArrangementFor(activeListing.onChainListingId);
  }

  const next = () => setStep((s) => s + 1);

  const reset = () => {
    setStep(0);
    setSubmitError(null);
    onClose();
  };

  const confirm = async () => {
    if (!isContractConfigured()) {
      setSubmitError("VeilBidding contract isn't deployed yet - set VITE_VEILBIDDING_ADDRESS in .env.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitStepLabel("");

    try {
      let teePublicKey = STATIC_TEE_PUBLIC_KEY;
      if (isProxyConfigured()) {
        teePublicKey = await fetchLiveTeePublicKey();
      }
      if (!teePublicKey) {
        throw new Error("No TEE public key available - set VITE_EXT_PROXY_URL (real TEE) or VITE_TEE_PUBLIC_KEY (demo).");
      }

      const signer = await getBrowserSigner();
      const contract = getVeilBiddingContract(signer);

      const nonce = randomNonce();
      const guessCommitment = computeCipherGuessCommitment({ arrangement, nonce, guesser: address });
      const encryptedGuess = await encryptCipherGuess({ arrangement, nonce, guesser: address }, teePublicKey);

      setSubmitStepLabel("Sealing and submitting your guess…");
      const tx = await contract.submitCipherGuess(activeListing.onChainListingId, guessCommitment, encryptedGuess);
      await tx.wait();

      onSubmit?.({ arrangement, txHash: tx.hash });
      next();
    } catch (err) {
      setSubmitError(err?.reason ?? err?.message ?? "Failed to submit sealed guess on-chain.");
    } finally {
      setSubmitting(false);
      setSubmitStepLabel("");
    }
  };

  if (!activeListing) return null;

  return (
    <Drawer opened={opened} onClose={reset} position="right" size="md" title="Submit Your Guess">
      <Stepper active={step} allowNextStepsSelect={false}>
        <Stepper.Step label="Arrange">
          <Stack mt="xl">
            <Alert icon={<LuLock />} color="slate">
              Your guess is sealed and encrypted until the deadline - nobody,
              including the creator, can see it until then.
            </Alert>

            <WordArrangementInput words={activeListing.words} arrangement={arrangement} onChange={setArrangement} />

            <Button mt="md" onClick={next}>
              Continue
            </Button>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Review">
          <Stack mt="xl">
            <Alert icon={<LuLock />}>
              This sealed guess will be ECIES-encrypted, committed on-chain,
              and only scored by the TEE after the deadline.
            </Alert>

            <Divider />

            <Group justify="space-between">
              <Text c="dimmed">Words</Text>
              <Text fw={600}>{activeListing.wordCount}</Text>
            </Group>

            {submitting && submitStepLabel && (
              <Text size="sm" c="dimmed">
                {submitStepLabel}
              </Text>
            )}

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
              Sealed Guess Submitted
            </Text>

            <Text ta="center" c="dimmed">
              Your guess is locked in. It stays hidden until the deadline,
              when the winner is revealed automatically.
            </Text>

            <Button onClick={reset}>Done</Button>
          </Stack>
        </Stepper.Completed>
      </Stepper>
    </Drawer>
  );
}
