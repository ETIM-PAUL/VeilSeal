import { Badge, Group, Text } from "@mantine/core";
import { LuUsers, LuTrophy } from "react-icons/lu";

import BidThumbnail from "./BidThumbnail";
import { statusColor } from "../../utils/status";
import { getBidStatus, getWinner, formatCountdown } from "../../utils/bids";

export default function BidCard({ bid, onOpen }) {
  const status = getBidStatus(bid);
  const winner = status === "Closed" ? getWinner(bid) : null;
  const iWon = winner?.mine;

  return (
    <div
      className="panel"
      style={{ padding: 16, cursor: "pointer" }}
      onClick={() => onOpen(bid.id)}
    >
      <BidThumbnail itemType={bid.itemType} />

      <Group justify="space-between" mt="md" mb={2} align="flex-start" wrap="nowrap">
        <Text fw={600} size="sm" style={{ fontFamily: "var(--font-display)" }}>
          {bid.title}
        </Text>

        <Badge color={iWon ? "signal" : statusColor(status)}>
          {iWon ? "You Won" : status}
        </Badge>
      </Group>

      <Text className="caption" mb="md" lineClamp={2}>
        {bid.description}
      </Text>

      <Group justify="space-between" align="flex-end">
        <div>
          <div className="label-micro">Min. Bid</div>
          <div className="num-md" style={{ marginTop: 2 }}>
            {bid.minBid.toLocaleString()} {bid.token}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="label-micro">
            {status === "Open" ? formatCountdown(bid.deadline) : "Revealed"}
          </div>

          <Group gap={4} justify="flex-end" mt={2}>
            <LuUsers size={12} className="ink-faint" />
            <Text size="xs" className="ink-dim num">
              {bid.participants.filter((p) => !p.withdrawn).length}
            </Text>
          </Group>
        </div>
      </Group>

      {iWon && (
        <Group gap={6} mt="sm" className="hairline-top" pt="sm">
          <LuTrophy size={13} color="var(--signal)" />
          <Text size="xs" fw={600} c="var(--signal-ink)">
            Winning bid — {winner.amount.toLocaleString()} {bid.token}
          </Text>
        </Group>
      )}
    </div>
  );
}
