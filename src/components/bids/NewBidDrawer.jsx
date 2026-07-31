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
  INVITE_ONLY_MIN_SCORE,
} from "../../contracts/VeilBidding";
import { toChainAmount } from "../../utils/sealedBid";
import { uploadFileToPinata, ipfsGatewayUrl, isPinataConfigured } from "../../lib/pinata";

// "score" — TEE-verified minimum wallet score, with an optional invite list
// that bypasses the score check. "invite" — only creator-invited addresses
// can bid at all, no score escape hatch. Every listing is gated one way or
// the other — there's no fully open mode.
const ACCESS_MODES = [
  { value: "score", label: "Score-Gated" },
  { value: "invite", label: "Invite Only" },
];

const initial = {
  title: "",
  description: "",
  itemType: "image",
  fileName: "",
  previewUrl: "",
  ipfsHash: "",
  deadline: null,
  minBid: undefined,
  token: "FLR",
  accessMode: "score",
  minScore: 50,
  participants: "",
};

function parseParticipants(raw) {
  return raw
    .split(/[\s,]+/)
    .map((a) => a.trim())
    .filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a));
}

export default function NewBidDrawer({ opened, onClose, onCreate }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const fileInputRef = useRef(null);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const next = () => setStep((s) => s + 1);

  const reset = () => {
    setForm(initial);
    setStep(0);
    setUploadError(null);
    setPublishError(null);
    onClose();
  };

  const handleFile = async (e) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    if (!isPinataConfigured()) {
      setUploadError("VITE_PINATA_JWT isn't set — add it to .env to upload files.");
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

  const publish = async () => {
    if (!isContractConfigured()) {
      setPublishError("VeilBidding contract isn't deployed yet — set VITE_VEILBIDDING_ADDRESS in .env.");
      return;
    }

    setPublishing(true);
    setPublishError(null);

    try {
      const signer = await getBrowserSigner();
      const contract = getVeilBiddingContract(signer);
      const deadlineUnix = Math.floor(form.deadline.getTime() / 1000);
      const minScore =
        form.accessMode === "invite" ? BigInt(INVITE_ONLY_MIN_SCORE) : BigInt(Math.round(form.minScore));
      const initialParticipants = parseParticipants(form.participants);
      const tx = await contract.createListing(
        form.title,
        form.description,
        form.itemType,
        form.ipfsHash,
        toChainAmount(form.minBid),
        minScore,
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
        onChainListingId: createdEvent.args.listingId.toString(),
        txHash: tx.hash,
      });
      next();
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
    (form.accessMode !== "invite" || parseParticipants(form.participants).length > 0);

  return (
    <Drawer opened={opened} onClose={reset} position="right" size="xl" title="Create Bid Listing">
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
                        TEE-verified privately per bidder — their exact score
                        is never revealed, only whether they clear your bar.
                      </Text>

                      <NumberInput
                        label="Minimum Score (0-100)"
                        value={form.minScore}
                        onChange={set("minScore")}
                        min={1}
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
                        Only these addresses can bid — no score check, no
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
              <Text fw={600}>{form.deadline ? formatDeadline(form.deadline) : "—"}</Text>
            </Group>

            <Group justify="space-between" wrap="nowrap">
              <Text c="dimmed">IPFS CID</Text>
              <Text fw={600} className="num" style={{ textAlign: "right" }} lineClamp={1}>
                {form.ipfsHash}
              </Text>
            </Group>

            <Group justify="space-between">
              <Text c="dimmed">Who Can Bid</Text>
              <Text fw={600}>{form.accessMode === "invite" ? "Invite only" : `Min score ${form.minScore}`}</Text>
            </Group>

            {parseParticipants(form.participants).length > 0 && (
              <Group justify="space-between" wrap="nowrap">
                <Text c="dimmed">{form.accessMode === "invite" ? "Invited" : "Invited (bypass gate)"}</Text>
                <Text fw={600}>{parseParticipants(form.participants).length} address(es)</Text>
              </Group>
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
              Confirm the transaction to create this listing on-chain (Coston2)
              and open sealed bidding.
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
              Bid Listing Live
            </Text>

            <Text ta="center" c="dimmed">
              Your item is pinned and sealed bidding is now open until the
              deadline.
            </Text>

            <Button onClick={reset} leftSection={<LuGavel size={15} />}>
              Done
            </Button>
          </Stack>
        </Stepper.Completed>
      </Stepper>
    </Drawer>
  );
}
