import { useRef, useState } from "react";

import {
  Alert,
  Button,
  Divider,
  Drawer,
  Grid,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";

import { LuArrowRight, LuCheckCheck, LuPuzzle, LuShieldCheck, LuUpload, LuWallet } from "react-icons/lu";

import BidThumbnail from "../bids/BidThumbnail";
import { ITEM_TYPES, formatDeadline } from "../../utils/bids";
import { getVeilBiddingContract, getBrowserSigner, isContractConfigured } from "../../contracts/VeilBidding";
import { uploadFileToPinata, ipfsGatewayUrl, isPinataConfigured } from "../../lib/pinata";

const WORD_COUNTS = [
  { value: "12", label: "12 Words" },
  { value: "24", label: "24 Words" },
];

function initialForm() {
  return {
    title: "",
    description: "",
    itemType: "image",
    fileName: "",
    previewUrl: "",
    ipfsHash: "",
    wordCount: "12",
    wordsInput: "",
    deadline: null,
    participants: "",
  };
}

function parseWords(raw) {
  return raw
    .split(/[\n,]+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function parseParticipants(raw) {
  return raw
    .split(/[\s,]+/)
    .map((a) => a.trim())
    .filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a));
}

/// Cipher listing creation drawer: an auctioned item (title/description/
/// itemType/IPFS upload, exactly like NewBidDrawer's "Item" step) plus a
/// word list + word-count + deadline + invited participants. Always
/// invite-gated, no minBid/score - the winner is decided by the word
/// challenge, not a bid amount. createCipherListing is a pure on-chain call -
/// no TEE round-trip at creation, the TEE only generates its reordering at reveal.
export default function NewCipherListingDrawer({ opened, onClose, onCreate = () => {} }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const fileInputRef = useRef(null);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const next = () => setStep((s) => s + 1);

  const reset = () => {
    setForm(initialForm());
    setStep(0);
    setUploadError(null);
    setPublishError(null);
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

  const words = parseWords(form.wordsInput);
  const targetCount = Number(form.wordCount);
  const participants = parseParticipants(form.participants);

  const canContinue =
    Boolean(form.title) &&
    words.length === targetCount &&
    Boolean(form.deadline) &&
    participants.length > 0;

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

      const deadlineUnix = Math.floor(form.deadline.getTime() / 1000);
      const tx = await contract.createCipherListing(
        form.title,
        form.description,
        form.itemType,
        form.ipfsHash,
        words,
        deadlineUnix,
        participants
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
        .find((parsed) => parsed?.name === "CipherListingCreated");

      if (!createdEvent) throw new Error("CipherListingCreated event not found in transaction receipt.");

      onCreate({
        title: form.title,
        description: form.description,
        itemType: form.itemType,
        previewUrl: form.previewUrl,
        ipfsHash: form.ipfsHash,
        words,
        wordCount: words.length,
        deadline: form.deadline.toISOString(),
        onChainListingId: createdEvent.args.listingId.toString(),
        txHash: tx.hash,
      });
      next();
    } catch (err) {
      setPublishError(err?.reason ?? err?.message ?? "Failed to create cipher listing on-chain.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Drawer opened={opened} onClose={reset} position="right" size="lg" title="New Cipher Listing">
      <Stepper active={step} allowNextStepsSelect={false}>
        <Stepper.Step label="Item">
          <Grid mt="lg">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Stack>
                <Alert icon={<LuPuzzle />} color="slate">
                  Invited participants try to predict the order the TEE will
                  secretly rearrange your words into. Closest match wins the
                  item - not a raffle, a skill-based challenge.
                </Alert>

                <TextInput
                  label="Item Title"
                  placeholder="Genesis Punk #142"
                  value={form.title}
                  onChange={(e) => set("title")(e.currentTarget.value)}
                  required
                />

                <Textarea
                  label="Description"
                  placeholder="Describe the item being auctioned..."
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

                <SegmentedControl data={WORD_COUNTS} value={form.wordCount} onChange={set("wordCount")} fullWidth />

                <Textarea
                  label={`Word List (${targetCount} words, comma or newline separated)`}
                  placeholder="ocean, lantern, gravity, ..."
                  minRows={4}
                  autosize
                  value={form.wordsInput}
                  onChange={(e) => set("wordsInput")(e.currentTarget.value)}
                  description={`${words.length} of ${targetCount} words entered`}
                />

                <DateTimePicker
                  label="Deadline"
                  placeholder="Select deadline"
                  value={form.deadline}
                  onChange={(value) => set("deadline")(value ? new Date(value) : null)}
                  minDate={new Date()}
                  clearable
                  description="Guesses are sealed until this deadline, then revealed automatically"
                />

                <Textarea
                  label="Invited Participants"
                  description="Cipher listings are always invite-only - the item and word list are public, but only invited wallets can guess."
                  placeholder="0xabc..., 0xdef..."
                  minRows={2}
                  autosize
                  required
                  value={form.participants}
                  onChange={(e) => set("participants")(e.currentTarget.value)}
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
              The item and word list are public. The TEE will generate its
              true arrangement fresh at reveal time - nobody, including
              VeilSeal, knows it before then.
            </Alert>

            <Divider />

            <Group justify="space-between">
              <Text c="dimmed">Item</Text>
              <Text fw={600}>{form.title}</Text>
            </Group>

            <Group justify="space-between">
              <Text c="dimmed">Words</Text>
              <Text fw={600}>{words.length}</Text>
            </Group>

            <Group justify="space-between">
              <Text c="dimmed">Deadline</Text>
              <Text fw={600}>{form.deadline ? formatDeadline(form.deadline) : "-"}</Text>
            </Group>

            <Group justify="space-between">
              <Text c="dimmed">Invited</Text>
              <Text fw={600}>{participants.length} address(es)</Text>
            </Group>

            {publishError && (
              <Text size="sm" style={{ color: "var(--danger)" }}>
                {publishError}
              </Text>
            )}

            <Button leftSection={<LuWallet size={15} />} onClick={publish} loading={publishing}>
              Sign with Wallet
            </Button>
          </Stack>
        </Stepper.Step>

        <Stepper.Completed>
          <Stack mt={50} align="center">
            <LuCheckCheck size={72} color="var(--signal)" />

            <Text fw={700} size="xl">
              Cipher Listing Created
            </Text>

            <Text ta="center" c="dimmed">
              Invited participants can now submit sealed guesses. The winner
              is revealed automatically once the deadline passes.
            </Text>

            <Button onClick={reset}>Done</Button>
          </Stack>
        </Stepper.Completed>
      </Stepper>
    </Drawer>
  );
}
