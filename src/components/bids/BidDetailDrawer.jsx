import { useEffect, useState } from "react";
import { Anchor, Badge, Button, Drawer, Group, Loader, Stack, Text } from "@mantine/core";
import { LuGavel, LuLock, LuTrophy, LuUndo2, LuShieldCheck, LuExternalLink } from "react-icons/lu";

import BidThumbnail from "./BidThumbnail";
import { statusColor } from "../../utils/status";
import { getBidStatus, getWinner, formatCountdown, formatDeadline } from "../../utils/bids";
import { fetchOnChainListing, isContractConfigured } from "../../contracts/VeilBidding";
import { truncateAddress, explorerTxUrl } from "../../utils/network";
import { fromChainAmount } from "../../utils/sealedBid";

export default function BidDetailDrawer({ opened, onClose, bid: liveBid, onPlaceBid, onWithdraw }) {
  // Keep the last known bid around so the drawer content stays in place
  // while it animates closed, instead of vanishing mid-transition.
  const [cachedBid, setCachedBid] = useState(liveBid);
  if (liveBid && liveBid !== cachedBid) {
    setCachedBid(liveBid);
  }
  const bid = liveBid ?? cachedBid;

  const [onChainData, setOnChainData] = useState(null);
  const [onChainLoading, setOnChainLoading] = useState(false);

  const onChainListingId = bid?.onChainListingId;

  useEffect(() => {
    let cancelled = false;

    // Deferred a tick so every state update below happens post-await,
    // never synchronously within the effect body.
    Promise.resolve().then(async () => {
      if (cancelled) return;

      if (!opened || !onChainListingId || !isContractConfigured()) {
        setOnChainData(null);
        return;
      }

      setOnChainLoading(true);
      try {
        const data = await fetchOnChainListing(onChainListingId);
        if (!cancelled) setOnChainData(data);
      } catch {
        if (!cancelled) setOnChainData(null);
      } finally {
        if (!cancelled) setOnChainLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [opened, onChainListingId]);

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

        {onChainListingId && (
          <div className="panel" style={{ padding: 14 }}>
            <Group gap={6} mb={onChainLoading || onChainData ? 10 : 0}>
              <LuShieldCheck size={13} color="var(--signal)" />
              <Text className="label-micro-strong">On-Chain Proof — Listing #{onChainListingId}</Text>
            </Group>

            {onChainLoading && <Loader size="xs" />}

            {!onChainLoading && onChainData?.revealed && (
              <Stack gap={6}>
                <Group justify="space-between">
                  <Text size="xs" className="ink-dim">
                    TEE-Attested Winner
                  </Text>
                  <Text size="xs" fw={600} className="num">
                    {truncateAddress(onChainData.winner)}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="xs" className="ink-dim">
                    Winning Amount
                  </Text>
                  <Text size="xs" fw={600} className="num">
                    {fromChainAmount(onChainData.winningAmount).toLocaleString()} {bid.token}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="xs" className="ink-dim">
                    Result Hash
                  </Text>
                  <Text size="xs" className="num ink-faint">
                    {truncateAddress(onChainData.resultHash)}
                  </Text>
                </Group>

                {onChainData.txHash && (
                  <Anchor
                    href={explorerTxUrl(onChainData.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    size="xs"
                  >
                    <Group gap={4}>
                      <span>View settlement transaction</span>
                      <LuExternalLink size={11} />
                    </Group>
                  </Anchor>
                )}
              </Stack>
            )}

            {!onChainLoading && onChainData && !onChainData.revealed && (
              <Text size="xs" className="ink-dim">
                Sealed bids are committed on Coston2. The TEE settlement watcher
                will decrypt and reveal the winner once the deadline passes.
              </Text>
            )}

            {!onChainLoading && !onChainData && (
              <Text size="xs" className="ink-faint">
                On-chain data unavailable — contract not configured or unreachable.
              </Text>
            )}
          </div>
        )}

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

                    {p.txHash && (
                      <Anchor href={explorerTxUrl(p.txHash)} target="_blank" rel="noreferrer" size="xs">
                        <Group gap={3}>
                          <span>sealed on-chain</span>
                          <LuExternalLink size={10} />
                        </Group>
                      </Anchor>
                    )}
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
