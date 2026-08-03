import { useEffect, useState } from "react";
import { Modal, Stack, Text, Loader, Button } from "@mantine/core";
import { LuShieldCheck } from "react-icons/lu";

import { useWallet } from "../../context/useWallet";
import {
  getVeilBiddingContract,
  getBrowserSigner,
  isContractConfigured,
  INSTRUCTION_FEE_WEI,
} from "../../contracts/VeilBidding";
import { requestMyScore } from "../../lib/tee/eligibility";

const AUTO_CLOSE_MS = 60000;

// Computes the connected wallet's signal score fresh every time it's opened -
// nothing is cached, since the underlying wallet signals (balance, activity,
// bid history) can change between checks. Auto-closes 5s after the score
// actually renders (not from open - the TEE round-trip itself takes a few
// seconds, so starting the timer any earlier would cut off the result).
export default function SignalScoreModal({ opened, onClose }) {
  const { address } = useWallet();
  const [loading, setLoading] = useState(false);
  const [stepLabel, setStepLabel] = useState("");
  const [score, setScore] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;

    (async () => {
      if (!address) {
        setError("Connect your wallet first.");
        return;
      }
      if (!isContractConfigured()) {
        setError("VeilBidding contract isn't configured.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const signer = await getBrowserSigner();
        const contract = getVeilBiddingContract(signer);
        const result = await requestMyScore(contract, INSTRUCTION_FEE_WEI, setStepLabel);
        if (!cancelled) setScore(result);
      } catch (err) {
        if (!cancelled) setError(err?.reason ?? err?.message ?? "Failed to compute signal score.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [opened, address]);

  // Reset for next time once the modal has actually closed, rather than
  // reacting to `!opened` above (which would setState synchronously in the
  // effect body) - the exit transition still shows the last result.
  const handleClose = () => {
    onClose();
    setScore(null);
    setError(null);
    setStepLabel("");
  };

  useEffect(() => {
    if (score === null) return;
    const t = setTimeout(handleClose, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  return (
    <Modal opened={opened} onClose={handleClose} title="Your Signal Score" centered size="sm">
      <Stack align="center" py="md" gap="sm">
        <Text size="xs" c="dimmed" ta="center" maw={320}>
          Score-gated listings require a minimum signal score to bid without an explicit invite.
          It's a 0-100 measure the TEE computes privately from your wallet's native balance,
          on-chain transaction count, and prior sealed bids on VeilPay - the underlying signals
          and the score itself never leave the enclave or touch the chain, only a pass/fail is
          ever revealed to a listing you try to bid on.
        </Text>

        {loading && (
          <>
            <Loader size="sm" />
            <Text size="sm" c="dimmed" ta="center">
              {stepLabel || "Computing your signal score…"}
            </Text>
          </>
        )}

        {!loading && error && (
          <>
            <Text size="sm" ta="center" style={{ color: "var(--danger)" }}>
              {error}
            </Text>
            <Button size="xs" variant="light" onClick={handleClose}>
              Close
            </Button>
          </>
        )}

        {!loading && !error && score !== null && (
          <>
            <LuShieldCheck size={28} color="var(--signal)" />
            <div className="num-xl">{score}/100</div>
            <Text size="xs" c="dimmed" ta="center" maw={280}>
              Computed privately by the TEE from your wallet's balance, activity,
              and bidding history - never shared or stored anywhere.
            </Text>
          </>
        )}
      </Stack>
    </Modal>
  );
}
