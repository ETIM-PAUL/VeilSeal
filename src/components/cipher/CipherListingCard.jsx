import { Badge, Group, Text } from "@mantine/core";
import { LuPuzzle, LuUsers, LuTrophy } from "react-icons/lu";

import BidThumbnail from "../bids/BidThumbnail";
import { statusColor } from "../../utils/status";
import { getBidStatus, formatCountdown } from "../../utils/bids";

export default function CipherListingCard({ listing, onOpen }) {
  const status = getBidStatus(listing);
  const iWon = listing.revealed && listing.winner && listing.mine;

  return (
    <div className="panel" style={{ padding: 16, cursor: "pointer" }} onClick={() => onOpen(listing.id)}>
      <BidThumbnail itemType={listing.itemType} previewUrl={listing.previewUrl} ipfsHash={listing.ipfsHash} />

      <Group justify="space-between" mt="md" mb={2} align="flex-start" wrap="nowrap">
        <Group gap={6} wrap="nowrap">
          <LuPuzzle size={14} className="ink-dim" />
          <Text fw={600} size="sm" style={{ fontFamily: "var(--font-display)" }}>
            {listing.title}
          </Text>
        </Group>

        <Badge color={iWon ? "signal" : statusColor(status)}>{iWon ? "You Won" : status}</Badge>
      </Group>

      <Text className="caption" mb="md" lineClamp={2}>
        {listing.description}
      </Text>

      <Group justify="space-between" align="flex-end">
        <div>
          <div className="label-micro">Words</div>
          <div className="num-md" style={{ marginTop: 2 }}>
            {listing.wordCount}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="label-micro">
            {status === "Open" ? formatCountdown(listing.deadline) : listing.revealed ? "Revealed" : "Awaiting Reveal"}
          </div>

          <Group gap={4} justify="flex-end" mt={2}>
            <LuUsers size={12} className="ink-faint" />
            <Text size="xs" className="ink-dim num">
              {listing.guesserCount}
            </Text>
          </Group>
        </div>
      </Group>

      {iWon && (
        <Group gap={6} mt="sm" className="hairline-top" pt="sm">
          <LuTrophy size={13} color="var(--signal)" />
          <Text size="xs" fw={600} c="var(--signal-ink)">
            You matched the arrangement closest
          </Text>
        </Group>
      )}
    </div>
  );
}
