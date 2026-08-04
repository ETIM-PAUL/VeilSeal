import { useRef, useState } from "react";

import {
  Alert,
  Button,
  Divider,
  Drawer,
  Grid,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";

import {
  LuArrowRight,
  LuCheckCheck,
  LuCopy,
  LuGavel,
  LuShieldCheck,
  LuUpload,
} from "react-icons/lu";

import BidThumbnail from "./BidThumbnail";
import { ITEM_TYPES, formatDeadline } from "../../utils/bids";
import {
  getVeilBiddingContract,
  getBrowserSigner,
  isContractConfigured,
  parseStealthListingCreatedEvent,
  MIN_SCORE_THRESHOLD,
} from "../../contracts/VeilBidding";
import { toChainAmount, encryptStealthDetails, randomNonce } from "../../utils/sealedBid";
import { fetchLiveTeePublicKey } from "../../lib/tee/ecies";
import { isProxyConfigured } from "../../lib/tee/proxy";
import { uploadFileToPinata, ipfsGatewayUrl, isPinataConfigured } from "../../lib/pinata";

// Static fallback for the self-contained (non-real-registry) contract path -
// see PlaceBidDrawer.jsx for the same pattern applied to sealed bids.
const STATIC_TEE_PUBLIC_KEY = import.meta.env.VITE_TEE_PUBLIC_KEY;

// "score" - TEE-verified minimum wallet score, with an optional invite list
// that bypasses the score check. "invite" - only creator-invited addresses
// can bid at all, no score escape hatch. Every listing is gated one way or
// the other - there's no fully open mode.
const ACCESS_MODES = [
  { value: "score", label: "Score-Gated" },
  { value: "invite", label: "Invite Only" },
];

function initialForm(lockedType) {
  return {
    title: "",
    description: "",
    itemType: "image",
    fileName: "",
    previewUrl: "",
    ipfsHash: "",
    deadline: null,
    minBid: undefined,
    token: "FLR",
    listingType: lockedType ?? "standard",
    accessMode: "score",
    minScore: 50,
    participants: "",
  };
}

function parseParticipants(raw) {
  return raw
    .split(/[\s,]+/)
    .map((a) => a.trim())
    .filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a));
}

/// @param lockedType "standard" | "stealth" - every entry point (Dashboard,
///   Standard Listings, Stealth Listings) already knows which kind it wants
///   before opening this drawer, so the type is always fixed rather than
///   chosen inside it.
export default function NewBidDrawer({ opened, onClose, onCreate = () => {}, lockedType }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => initialForm(lockedType));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [createdHashedId, setCreatedHashedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const next = () => setStep((s) => s + 1);

  const reset = () => {
    setForm(initialForm(lockedType));
    setStep(0);
    setUploadError(null);
    setPublishError(null);
    setCreatedHashedId(null);
    setCopied(false);
    onClose();
  };

  const handleFile = async (e) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    if (!isPinataConfigured()) {
      setUploadError("VITE_PINATA_JWT isn't set - add it to .env to upload files.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setForm((f) => ({ ...f, fileName: file.name, previewUrl: "", ipfsHash: "" }));

    try {
      const cid = await uploadFileToPinata(file);
      setForm((f) => ({ ...f, ipfsHash: cid, previewUrl: ipfsGatewayUrl(cid) }));
    } catch (err) {
      setUploadError(err?.message ?? "Failed to upload file to IPFS.");
    } finally {
      setUploading(false);
    }
  };

  const accept =
    form.itemType === "image"
      ? "image/*"
      : form.itemType === "video"
      ? "video/*"
      : form.itemType === "audio"
      ? "audio/*"
      : undefined;

  const publishStealth = async (contract) => {
    let teePublicKey = STATIC_TEE_PUBLIC_KEY;
    if (isProxyConfigured()) {
      teePublicKey = await fetchLiveTeePublicKey();
    }
    if (!teePublicKey) {
      throw new Error("No TEE public key available - set VITE_EXT_PROXY_URL (real TEE) or VITE_TEE_PUBLIC_KEY (demo).");
    }

    const deadlineUnix = Math.floor(form.deadline.getTime() / 1000);
    const initialParticipants = parseParticipants(form.participants);
    const nonce = randomNonce();
    const encryptedDetails = await encryptStealthDetails(
      {
        title: form.title,
        description: form.description,
        itemType: form.itemType,
        ipfsHash: form.ipfsHash,
        minBid: toChainAmount(form.minBid),
        nonce,
      },
      teePublicKey
    );

    const tx = await contract.createStealthListing(encryptedDetails, deadlineUnix, initialParticipants);
    const receipt = await tx.wait();

    const hashedId = parseStealthListingCreatedEvent(receipt, contract);
    if (!hashedId) throw new Error("StealthListingCreated event not found in transaction receipt.");

    setCreatedHashedId(hashedId);
    // Stealth listings are deliberately not added to the on-chain-discovered
    // grid (Bids.jsx only ever finds regular listings via ListingCreated) -
    // there's nothing for onCreate to do here beyond letting the drawer show
    // the hashedId on the completion step below.
    next();
  };

  const publishStandard = async (contract) => {
    const deadlineUnix = Math.floor(form.deadline.getTime() / 1000);
    const inviteOnly = form.accessMode === "invite";
    const minScore = BigInt(Math.round(form.minScore));
    const initialParticipants = parseParticipants(form.participants);
    const tx = await contract.createListing(
      form.title,
      form.description,
      form.itemType,
      form.ipfsHash,
      toChainAmount(form.minBid),
      minScore,
      inviteOnly,
      deadlineUnix,
      initialParticipants
    );
    const receipt = await tx.wait();

    const createdEvent = receipt.logs
      .map((log) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed?.name === "ListingCreated");

    if (!createdEvent) throw new Error("ListingCreated event not found in transaction receipt.");

    onCreate({
      title: form.title,
      description: form.description,
      itemType: form.itemType,
      previewUrl: form.previewUrl,
      ipfsHash: form.ipfsHash,
      deadline: form.deadline.toISOString(),
      minBid: form.minBid,
      minScore,
      inviteOnly,
      onChainListingId: createdEvent.args.listingId.toString(),
      txHash: tx.hash,
    });
    next();
  };

  const publish = async () => {
    if (!isContractConfigured()) {
      setPublishError("VeilBidding contract isn't deployed yet - set VITE_VEILBIDDING_ADDRESS in .env.");
      return;
    }

    setPublishing(true);
    setPublishError(null);

    try {
      const signer = await getBrowserSigner();
      const contract = getVeilBiddingContract(signer);

      if (form.listingType === "stealth") {
        await publishStealth(contract);
      } else {
        await publishStandard(contract);
      }
    } catch (err) {
      setPublishError(err?.reason ?? err?.message ?? "Failed to create listing on-chain.");
    } finally {
      setPublishing(false);
    }
  };

  const canContinue =
    form.title.trim() &&
    form.deadline &&
    form.minBid > 0 &&
    form.ipfsHash &&
    !uploading &&
    (form.listingType === "stealth" || form.accessMode !== "invite" || parseParticipants(form.participants).length > 0) &&
    (form.listingType !== "stealth" || parseParticipants(form.participants).length > 0);

  return (
    <Drawer
      opened={opened}
      onClose={reset}
      position="right"
      size="xl"
      title={lockedType === "stealth" ? "Create Stealth Listing" : "Create Listing"}
    >
      <Stepper active={step} allowNextStepsSelect={false}>
        <Stepper.Step label="Item">
          <Grid mt="lg">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Stack>
                <TextInput
                  label="Item Title"
                  placeholder="Genesis Punk #142"
                  value={form.title}
                  onChange={(e) => set("title")(e.currentTarget.value)}
                  required
                />

                <Textarea
                  label="Description"
                  placeholder="Describe the item being sealed-bid auctioned..."
                  minRows={3}
                  autosize
                  value={form.description}
                  onChange={(e) => set("description")(e.currentTarget.value)}
                />

                <Select
                  label="Item Type"
                  data={ITEM_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                  value={form.itemType}
                  onChange={(v) => setForm((f) => ({ ...f, itemType: v, previewUrl: "", fileName: "" }))}
                />

                <div>
                  <Text size="sm" fw={500} mb={6}>
                    Upload Item (IPFS via Pinata)
                  </Text>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    onChange={handleFile}
                    style={{ display: "none" }}
                  />

                  <Button
                    variant="light"
                    leftSection={<LuUpload size={15} />}
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                  >
                    {form.fileName ? "Replace File" : "Choose File"}
                  </Button>

                  {form.fileName && (
                    <Text className="caption" mt={6}>
                      {uploading ? `Uploading ${form.fileName}...` : form.fileName}
                    </Text>
                  )}

                  {form.ipfsHash && (
                    <Text size="xs" className="ink-faint num" mt={4}>
                      ipfs://{form.ipfsHash}
                    </Text>
                  )}

                  {uploadError && (
                    <Text size="sm" mt={6} style={{ color: "var(--danger)" }}>
                      {uploadError}
                    </Text>
                  )}
                </div>

                <Group grow>
                  <NumberInput
                    label="Minimum Bid"
                    placeholder="100"
                    value={form.minBid}
                    onChange={set("minBid")}
                    thousandSeparator=","
                    min={0}
                  />
                </Group>

                {form.listingType === "stealth" && (
                  <Text size="xs" className="ink-dim">
                    Title, description, item type, IPFS link, and minimum bid are all
                    ECIES-encrypted before they ever reach the contract - nothing about
                    what's being auctioned is readable on-chain. Always invite-only:
                    you'll get a hashed ID after creating it to share with invited
                    bidders directly, since there's no public listing to browse into.
                  </Text>
                )}

                {form.listingType === "stealth" ? (
                  <Textarea
                    label="Invited Participants"
                    description="Comma or newline-separated wallet addresses - the only way anyone can bid or view this listing's details."
                    placeholder="0xabc..., 0xdef..."
                    minRows={2}
                    autosize
                    required
                    value={form.participants}
                    onChange={(e) => set("participants")(e.currentTarget.value)}
                  />
                ) : (
                <div>
                  <Text size="sm" fw={500} mb={6}>
                    Who Can Bid
                  </Text>

                  <SegmentedControl
                    fullWidth
                    data={ACCESS_MODES}
                    value={form.accessMode}
                    onChange={set("accessMode")}
                  />

                  {form.accessMode === "score" && (
                    <Stack gap="sm" mt="sm">
                      <Text size="xs" className="ink-dim">
                        TEE-verified privately per bidder - their exact score
                        is never revealed onchain, only whether they clear your bar.
                      </Text>

                      <NumberInput
                        label={`Minimum Score (${MIN_SCORE_THRESHOLD}-100)`}
                        value={form.minScore}
                        onChange={set("minScore")}
                        min={MIN_SCORE_THRESHOLD}
                        max={100}
                      />

                      <Textarea
                        label="Invited Participants (optional)"
                        description="Comma or newline-separated wallet addresses that bypass the score requirement entirely."
                        placeholder="0xabc..., 0xdef..."
                        minRows={2}
                        autosize
                        value={form.participants}
                        onChange={(e) => set("participants")(e.currentTarget.value)}
                      />
                    </Stack>
                  )}

                  {form.accessMode === "invite" && (
                    <Stack gap="sm" mt="sm">
                      <Text size="xs" className="ink-dim">
                        Only these addresses can bid - no score check, no
                        exceptions. Add more later from the listing page.
                      </Text>

                      <Textarea
                        label="Invited Participants"
                        description="Comma or newline-separated wallet addresses."
                        placeholder="0xabc..., 0xdef..."
                        minRows={2}
                        autosize
                        required
                        value={form.participants}
                        onChange={(e) => set("participants")(e.currentTarget.value)}
                      />
                    </Stack>
                  )}
                </div>
                )}

                <DateTimePicker
                  label="Bid Deadline"
                  placeholder="Select deadline"
                  value={form.deadline}
                  onChange={(value) => set("deadline")(value ? new Date(value) : null)}
                  minDate={new Date()}
                  clearable
                  description="Bids are sealed until this deadline, then revealed automatically"
                />

                <Button
                  mt="md"
                  rightSection={<LuArrowRight size={15} />}
                  onClick={next}
                  disabled={!canContinue}
                >
                  Review Listing
                </Button>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 5 }}>
              <div className="panel" style={{ padding: 16 }}>
                <BidThumbnail itemType={form.itemType} previewUrl={form.previewUrl} height={160} />

                <Text fw={600} mt="md" style={{ fontFamily: "var(--font-display)" }}>
                  {form.title || "Untitled Item"}
                </Text>

                <Text className="caption" mt={4} lineClamp={3}>
                  {form.description || "No description yet"}
                </Text>
              </div>
            </Grid.Col>
          </Grid>
        </Stepper.Step>

        <Stepper.Step label="Review">
          <Stack mt="xl">
            <Alert icon={<LuShieldCheck />}>
              Sealed bids on this item stay hidden until the deadline. Amounts are
              revealed and the winner selected automatically through Flare
              Confidential Compute.
            </Alert>

            <Divider />

            <Group justify="space-between">
              <Text c="dimmed">Title</Text>
              <Text fw={600}>{form.title}</Text>
            </Group>

            <Group justify="space-between">
              <Text c="dimmed">Minimum Bid</Text>
              <Text fw={600} className="num">
                {form.minBid?.toLocaleString()} FLR
              </Text>
            </Group>

            <Group justify="space-between">
              <Text c="dimmed">Deadline</Text>
              <Text fw={600}>{form.deadline ? formatDeadline(form.deadline) : "-"}</Text>
            </Group>

            <Group justify="space-between" wrap="nowrap">
              <Text c="dimmed">IPFS CID</Text>
              <Text fw={600} className="num" style={{ textAlign: "right" }} lineClamp={1}>
                {form.ipfsHash}
              </Text>
            </Group>

            <Group justify="space-between">
              <Text c="dimmed">Who Can Bid</Text>
              <Text fw={600}>
                {form.listingType === "stealth"
                  ? "Stealth (invite only)"
                  : form.accessMode === "invite"
                  ? "Invite only"
                  : `Min score ${form.minScore}`}
              </Text>
            </Group>

            {parseParticipants(form.participants).length > 0 && (
              <Group justify="space-between" wrap="nowrap">
                <Text c="dimmed">
                  {form.listingType === "stealth" || form.accessMode === "invite" ? "Invited" : "Invited (bypass gate)"}
                </Text>
                <Text fw={600}>{parseParticipants(form.participants).length} address(es)</Text>
              </Group>
            )}

            {form.listingType === "stealth" && (
              <Text size="xs" className="ink-dim">
                Title, description, item type, IPFS link, and minimum bid will be encrypted
                before this listing is created - only invited participants will ever be able
                to see them, and only via the hashed ID you'll get after signing.
              </Text>
            )}

            <Button leftSection={<LuGavel size={15} />} onClick={next}>
              Sign with Wallet
            </Button>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Sign">
          <Stack mt={60} align="center">
            <LuGavel size={48} color="var(--ink-dim)" />

            <Text fw={700} size="lg">
              Awaiting Wallet Signature
            </Text>

            <Text ta="center" c="dimmed">
              {form.listingType === "stealth"
                ? "Confirm the transaction to encrypt and create this listing on-chain (Coston2) and open sealed bidding."
                : "Confirm the transaction to create this listing on-chain (Coston2) and open sealed bidding."}
            </Text>

            {publishError && (
              <Text ta="center" size="sm" style={{ color: "var(--danger)" }}>
                {publishError}
              </Text>
            )}

            <Button mt="lg" onClick={publish} loading={publishing}>
              Create Listing On-Chain
            </Button>
          </Stack>
        </Stepper.Step>

        <Stepper.Completed>
          <Stack mt={60} align="center">
            <LuCheckCheck size={72} color="var(--signal)" />

            <Text fw={700} size="xl">
              {form.listingType === "stealth" ? "Stealth Listing Live" : "Bid Listing Live"}
            </Text>

            {form.listingType === "stealth" ? (
              <>
                <Text ta="center" c="dimmed" maw={420}>
                  This listing's details are encrypted on-chain. Share the hashed ID
                  below with invited bidders directly - it's the only way anyone can
                  find or view this listing.
                </Text>

                <Group
                  gap={8}
                  wrap="nowrap"
                  className="panel"
                  style={{ padding: "8px 12px", maxWidth: 420 }}
                >
                  <Text size="sm" className="num" style={{ wordBreak: "break-all" }}>
                    {createdHashedId}
                  </Text>

                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<LuCopy size={13} />}
                    onClick={() => {
                      navigator.clipboard.writeText(createdHashedId);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </Group>
              </>
            ) : (
              <Text ta="center" c="dimmed">
                Your item is pinned and sealed bidding is now open until the
                deadline.
              </Text>
            )}

            <Button onClick={reset} leftSection={<LuGavel size={15} />}>
              Done
            </Button>
          </Stack>
        </Stepper.Completed>
      </Stepper>
    </Drawer>
  );
}
