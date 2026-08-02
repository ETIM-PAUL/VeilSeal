import { useState } from "react";

import { Alert, Badge, Button, Divider, Group, Loader, NumberInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { LuGavel, LuLock, LuSearch, LuShieldCheck, LuSparkles } from "react-icons/lu";

import BidThumbnail from "../components/bids/BidThumbnail";
import { useWallet } from "../context/useWallet";
import { getBidStatus, formatCountdown, formatDeadline } from "../utils/bids";
import { truncateAddress, explorerTxUrl } from "../utils/network";
import {
  getVeilBiddingContract,
  getBrowserSigner,
  isContractConfigured,
  fetchStealthListingOnChain,
  fetchStealthBidders,
  INSTRUCTION_FEE_WEI,
} from "../contracts/VeilBidding";
import { fetchStealthDetails } from "../lib/tee/stealthProxy";
import { fetchLiveTeePublicKey } from "../lib/tee/ecies";
import { isProxyConfigured } from "../lib/tee/proxy";
import { requestAndRelayStealthReveal } from "../lib/tee/reveal";
import { computeTermsCommitment, encryptBidTerms, randomNonce, toChainAmount, fromChainAmount } from "../utils/sealedBid";

// Static fallback for the self-contained (non-real-registry) contract path -
// see PlaceBidDrawer.jsx for the same pattern applied to regular listings.
const STATIC_TEE_PUBLIC_KEY = import.meta.env.VITE_TEE_PUBLIC_KEY;

function isValidHashedId(value) {
  return /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

export default function StealthListings() {
  const { address } = useWallet();

  const [hashedIdInput, setHashedIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [listing, setListing] = useState(null);

  const [bidAmount, setBidAmount] = useState();
  const [bidding, setBidding] = useState(false);
  const [bidStepLabel, setBidStepLabel] = useState("");
  const [bidError, setBidError] = useState(null);
  const [bidSubmitted, setBidSubmitted] = useState(false);

  const [revealing, setRevealing] = useState(false);
  const [revealStepLabel, setRevealStepLabel] = useState("");
  const [revealError, setRevealError] = useState(null);

  // Successfully fetching details already proves the connected wallet is a
  // participant - the TEE's /stealth/{hashedId}/details endpoint rejects
  // anyone else outright, so there's no separate membership check to make
  // here (see stealth_handlers.go's stealthDetailsHandler).
  const handleLookup = async () => {
    const trimmed = hashedIdInput.trim();
    if (!isValidHashedId(trimmed)) {
      setLoadError("Enter a valid hashed ID (0x followed by 64 hex characters).");
      return;
    }
    if (!isContractConfigured()) {
      setLoadError("VeilBidding contract isn't deployed yet - set VITE_VEILBIDDING_ADDRESS in .env.");
      return;
    }

    setLoading(true);
    setLoadError(null);
    setListing(null);
    setBidSubmitted(false);
    setBidError(null);
    setRevealError(null);

    try {
      const onChain = await fetchStealthListingOnChain(trimmed);
      if (onChain.deadline === 0n) {
        throw new Error("No stealth listing found for this hashed ID.");
      }

      const signer = await getBrowserSigner();
      const details = await fetchStealthDetails(signer, trimmed);
      const bidders = await fetchStealthBidders(trimmed).catch(() => []);

      setListing({ hashedId: trimmed, onChain, details, bidders });
    } catch (err) {
      setLoadError(err?.reason ?? err?.message ?? "Failed to load stealth listing.");
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async () => {
    if (!listing) return;

    setBidding(true);
    setBidError(null);
    setBidStepLabel("");

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
      const wallet = address ?? (await signer.getAddress());

      const chainAmount = toChainAmount(bidAmount);
      const nonce = randomNonce();
      const termsCommitment = computeTermsCommitment({ amount: chainAmount, nonce, bidder: wallet });
      const encryptedTerms = await encryptBidTerms({ amount: chainAmount, nonce, bidder: wallet }, teePublicKey);

      setBidStepLabel("Sealing and submitting your bid…");
      const tx = await contract.submitStealthSealedBid(listing.hashedId, termsCommitment, encryptedTerms);
      await tx.wait();

      setBidSubmitted(true);
      const bidders = await fetchStealthBidders(listing.hashedId).catch(() => listing.bidders);
      setListing((l) => (l ? { ...l, bidders } : l));
    } catch (err) {
      setBidError(err?.reason ?? err?.message ?? "Failed to submit sealed bid.");
    } finally {
      setBidding(false);
      setBidStepLabel("");
    }
  };

  const handleRequestReveal = async () => {
    if (!listing) return;

    setRevealing(true);
    setRevealError(null);

    try {
      const signer = await getBrowserSigner();
      const contract = getVeilBiddingContract(signer);
      await requestAndRelayStealthReveal(contract, listing.hashedId, INSTRUCTION_FEE_WEI, setRevealStepLabel);

      const onChain = await fetchStealthListingOnChain(listing.hashedId);
      setListing((l) => (l ? { ...l, onChain } : l));
    } catch (err) {
      setRevealError(err?.reason ?? err?.message ?? "Failed to reveal listing.");
    } finally {
      setRevealing(false);
      setRevealStepLabel("");
    }
  };

  const deadlineMs = listing ? Number(listing.onChain.deadline) * 1000 : null;
  const status = listing ? getBidStatus({ deadline: deadlineMs }) : null;
  const revealed = listing?.onChain.revealed;
  const iWon = revealed && address && listing.onChain.winner.toLowerCase() === address.toLowerCase();

  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>Stealth Listings</Title>

        <Text className="caption" mt={4}>
          Every detail of a stealth listing is encrypted - nothing is browsable. If you've
          been invited, enter the hashed ID the creator shared with you to view and bid on it.
        </Text>
      </div>

      <div className="panel" style={{ padding: 16 }}>
        <Group align="flex-end" gap="sm">
          <TextInput
            style={{ flex: 1 }}
            label="Hashed Listing ID"
            placeholder="0x..."
            value={hashedIdInput}
            onChange={(e) => setHashedIdInput(e.currentTarget.value)}
          />

          <Button leftSection={<LuSearch size={15} />} onClick={handleLookup} loading={loading}>
            Reveal Listing
          </Button>
        </Group>

        {loadError && (
          <Text size="sm" mt="sm" style={{ color: "var(--danger)" }}>
            {loadError}
          </Text>
        )}
      </div>

      {loading && (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      )}

      {listing && (
        <div className="panel" style={{ padding: 20 }}>
          <Group align="flex-start" gap="xl" wrap="wrap">
            <BidThumbnail
              itemType={listing.details.itemType}
              ipfsHash={listing.details.ipfsHash}
              height={160}
            />

            <Stack gap={10} style={{ flex: 1, minWidth: 260 }}>
              <Group justify="space-between" align="flex-start">
                <Text fw={700} size="lg" style={{ fontFamily: "var(--font-display)" }}>
                  {listing.details.title}
                </Text>

                <Badge color={iWon ? "signal" : status === "Open" ? "blue" : revealed ? "signal" : "slate"}>
                  {iWon ? "You Won" : status === "Open" ? "Open" : revealed ? "Revealed" : "Awaiting Reveal"}
                </Badge>
              </Group>

              <Text className="caption">{listing.details.description}</Text>

              <Group gap="xl" mt={4}>
                <div>
                  <div className="label-micro">Minimum Bid</div>
                  <div className="num-md" style={{ marginTop: 2 }}>
                    {fromChainAmount(listing.details.minBid).toLocaleString()} FLR
                  </div>
                </div>

                <div>
                  <div className="label-micro">{status === "Open" ? "Time Left" : "Deadline"}</div>
                  <div className="num-md" style={{ marginTop: 2 }}>
                    {status === "Open" ? formatCountdown(deadlineMs) : formatDeadline(deadlineMs)}
                  </div>
                </div>

                <div>
                  <div className="label-micro">Sealed Bids</div>
                  <div className="num-md" style={{ marginTop: 2 }}>
                    {listing.bidders.length}
                  </div>
                </div>
              </Group>
            </Stack>
          </Group>

          <Divider my="lg" />

          {revealed ? (
            <Stack gap={6}>
              <Group justify="space-between">
                <Text size="sm" className="ink-dim">
                  TEE-Attested Winner
                </Text>
                <Text size="sm" fw={600} className="num">
                  {truncateAddress(listing.onChain.winner)}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" className="ink-dim">
                  Winning Amount
                </Text>
                <Text size="sm" fw={600} className="num">
                  {fromChainAmount(listing.onChain.winningAmount).toLocaleString()} FLR
                </Text>
              </Group>

              <Text size="xs" className="ink-faint" mt={4}>
                Listing details stay encrypted forever - revealing the winner never unlocks
                title/description/minBid to anyone who wasn't already a participant.
              </Text>

              {listing.onChain.txHash && (
                <Text size="xs" mt={4}>
                  <a href={explorerTxUrl(listing.onChain.txHash)} target="_blank" rel="noreferrer">
                    View settlement transaction
                  </a>
                </Text>
              )}
            </Stack>
          ) : status === "Open" ? (
            <Stack gap="sm">
              <Alert icon={<LuLock />} color="slate">
                Your bid amount is sealed and encrypted until the deadline - other bidders,
                and this page, cannot see it.
              </Alert>

              <Group align="flex-end" gap="sm">
                <NumberInput
                  style={{ flex: 1 }}
                  label="Bid Amount"
                  placeholder={`${fromChainAmount(listing.details.minBid)}`}
                  value={bidAmount}
                  onChange={setBidAmount}
                  thousandSeparator=","
                  min={fromChainAmount(listing.details.minBid)}
                  description={`Minimum bid is ${fromChainAmount(listing.details.minBid).toLocaleString()} FLR`}
                />

                <Button
                  leftSection={<LuGavel size={15} />}
                  onClick={handleBid}
                  loading={bidding}
                  disabled={!bidAmount || bidAmount < fromChainAmount(listing.details.minBid)}
                >
                  Seal Bid
                </Button>
              </Group>

              {bidding && bidStepLabel && (
                <Text size="sm" c="dimmed">
                  {bidStepLabel}
                </Text>
              )}

              {bidSubmitted && (
                <Text size="sm" style={{ color: "var(--signal-ink)" }}>
                  Sealed bid submitted. It stays hidden until the deadline.
                </Text>
              )}

              {bidError && (
                <Text size="sm" style={{ color: "var(--danger)" }}>
                  {bidError}
                </Text>
              )}
            </Stack>
          ) : (
            <Stack gap={8}>
              <Text size="sm" className="ink-dim">
                Bidding closed. Anyone can trigger the reveal - it routes every sealed bid to
                the registered TEE, which decrypts them, determines the winner, and signs the
                result. The listing's other details stay encrypted regardless.
              </Text>

              <Button
                size="xs"
                variant="light"
                leftSection={<LuSparkles size={13} />}
                onClick={handleRequestReveal}
                loading={revealing}
              >
                {revealing ? revealStepLabel || "Revealing…" : "Request & Relay Reveal"}
              </Button>

              {revealError && (
                <Text size="xs" style={{ color: "var(--danger)" }}>
                  {revealError}
                </Text>
              )}
            </Stack>
          )}
        </div>
      )}

      {!listing && !loading && (
        <div className="panel" style={{ padding: 24, textAlign: "center" }}>
          <LuShieldCheck size={28} color="var(--ink-faint)" />
          <Text className="caption" mt="sm">
            Nothing to show until you enter a hashed ID - stealth listings aren't browsable by design.
          </Text>
        </div>
      )}
    </Stack>
  );
}
