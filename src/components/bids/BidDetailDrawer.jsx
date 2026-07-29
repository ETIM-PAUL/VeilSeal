import { useState } from "react";
import { Badge, Button, Drawer, Group, Stack, Text } from "@mantine/core";
import { LuGavel, LuLock, LuTrophy, LuUndo2 } from "react-icons/lu";

import BidThumbnail from "./BidThumbnail";
import { statusColor } from "../../utils/status";
import { getBidStatus, getWinner, formatCountdown, formatDeadline } from "../../utils/bids";

export default function BidDetailDrawer({ opened, onClose, bid: liveBid, onPlaceBid, onWithdraw }) {
  // Keep the last known bid around so the drawer content stays in place
  // while it animates closed, instead of vanishing mid-transition.
  const [cachedBid, setCachedBid] = useState(liveBid);
  if (liveBid && liveBid !== cachedBid) {
    setCachedBid(liveBid);
  }
  const bid = liveBid ?? cachedBid;

  if (!bid) return null;

  const status = getBidStatus(bid);
  const winner = status === "Closed" ? getWinner(bid) : null;
  const iWon = winner?.mine;

  const sorted = [...bid.participants].sort((a, b) => {
    if (status === "Open") return 0;
    return b.amount - a.amount;
  });

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="lg" title={bid.title}>
      <Stack mt="md">
        <BidThumbnail itemType={bid.itemType} previewUrl={bid.previewUrl} height={180} />

        <Group justify="space-between" align="flex-start">
          <Text className="caption" maw={420}>
            {bid.description}
          </Text>

          <Badge color={iWon ? "signal" : statusColor(status)}>
            {iWon ? "You Won" : status}
          </Badge>
        </Group>

        <Group grow>
          <div className="panel" style={{ padding: 14 }}>
            <div className="label-micro">Minimum Bid</div>
            <div className="num-lg" style={{ marginTop: 4 }}>
              {bid.minBid.toLocaleString()} {bid.token}
            </div>
          </div>

          <div className="panel" style={{ padding: 14 }}>
            <div className="label-micro">{status === "Open" ? "Time Left" : "Deadline"}</div>
            <div className="num-lg" style={{ marginTop: 4, fontSize: "1rem" }}>
              {status === "Open" ? formatCountdown(bid.deadline) : formatDeadline(bid.deadline)}
            </div>
          </div>
        </Group>

        <Text size="xs" className="ink-faint num" style={{ wordBreak: "break-all" }}>
          IPFS: {bid.ipfsHash}
        </Text>

        {status === "Open" && (
          <Button leftSection={<LuGavel size={15} />} onClick={() => onPlaceBid(bid.id)}>
            Place Sealed Bid
          </Button>
        )}

        <div className="hairline-top" style={{ marginTop: 4 }} />

        <Text className="label-micro-strong">
          Participants ({bid.participants.filter((p) => !p.withdrawn).length})
        </Text>

        <Stack gap={0}>
          {sorted.length === 0 && (
            <Text className="caption" py="md">
              No bids submitted yet.
            </Text>
          )}

          {sorted.map((p, index) => {
            const isWinner = status === "Closed" && winner && p.id === winner.id && p.wallet === winner.wallet;
            const canWithdraw = status === "Closed" && p.mine && !isWinner && !p.withdrawn;

            return (
              <Group
                key={`${p.wallet}-${p.id}`}
                justify="space-between"
                py={10}
                className={index !== sorted.length - 1 ? "hairline-bottom" : ""}
                style={{
                  background: isWinner ? "var(--signal-bg)" : "transparent",
                  paddingLeft: isWinner ? 10 : 0,
                  paddingRight: isWinner ? 10 : 0,
                  borderRadius: isWinner ? 4 : 0,
                }}
              >
                <Group gap={8}>
                  {isWinner && <LuTrophy size={14} color="var(--signal)" />}

                  <div>
                    <Text size="sm" fw={600} className="num">
                      {p.wallet}
                      {p.mine && (
                        <span className="label-micro" style={{ marginLeft: 8 }}>
                          You
                        </span>
                      )}
                    </Text>

                    <Text size="xs" className="ink-faint">
                      {p.submittedAt}
                    </Text>
                  </div>
                </Group>

                <Group gap={10}>
                  {status === "Open" && !p.mine ? (
                    <Group gap={4}>
                      <LuLock size={12} className="ink-faint" />
                      <Text size="sm" className="ink-faint">
                        Sealed
                      </Text>
                    </Group>
                  ) : (
                    <Text size="sm" fw={600} className="num">
                      {p.amount.toLocaleString()} {bid.token}
                    </Text>
                  )}

                  {p.withdrawn && (
                    <Badge variant="outline" color="slate">
                      Withdrawn
                    </Badge>
                  )}

                  {canWithdraw && (
                    <Button
                      size="xs"
                      variant="light"
                      color="slate"
                      leftSection={<LuUndo2 size={13} />}
                      onClick={() => onWithdraw(bid.id, p.id)}
                    >
                      Withdraw
                    </Button>
                  )}
                </Group>
              </Group>
            );
          })}
        </Stack>
      </Stack>
    </Drawer>
  );
}
