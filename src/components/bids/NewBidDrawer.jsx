import { useRef, useState } from "react";

import {
  Alert,
  Button,
  Divider,
  Drawer,
  Grid,
  Group,
  NumberInput,
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
import { BID_TOKENS, ITEM_TYPES, formatDeadline, mockCid } from "../../utils/bids";
import { getVeilBiddingContract, getBrowserSigner, isContractConfigured } from "../../contracts/VeilBidding";

const initial = {
  title: "",
  description: "",
  itemType: "image",
  fileName: "",
  previewUrl: "",
  deadline: null,
  minBid: undefined,
  token: "FLR",
};

export default function NewBidDrawer({ opened, onClose, onCreate }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const fileInputRef = useRef(null);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const next = () => setStep((s) => s + 1);

  const reset = () => {
    setForm(initial);
    setStep(0);
    setPublishError(null);
    onClose();
  };

  const handleFile = (e) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, fileName: file.name, previewUrl: reader.result }));
    };
    reader.readAsDataURL(file);
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
      const tx = await contract.createListing(deadlineUnix);
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
        ipfsHash: mockCid(),
        deadline: form.deadline.toISOString(),
        minBid: form.minBid,
        token: form.token,
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

  const canContinue = form.title.trim() && form.deadline && form.minBid > 0;

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
                    Upload Item
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
                  >
                    {form.fileName ? "Replace File" : "Choose File"}
                  </Button>

                  {form.fileName && (
                    <Text className="caption" mt={6}>
                      {form.fileName}
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

                  <Select
                    label="Token"
                    data={BID_TOKENS}
                    value={form.token}
                    onChange={set("token")}
                  />
                </Group>

                <DateTimePicker
                  label="Bid Deadline"
                  placeholder="Select deadline"
                  value={form.deadline}
                  onChange={set("deadline")}
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
                {form.minBid?.toLocaleString()} {form.token}
              </Text>
            </Group>

            <Group justify="space-between">
              <Text c="dimmed">Deadline</Text>
              <Text fw={600}>{form.deadline ? formatDeadline(form.deadline) : "—"}</Text>
            </Group>

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
