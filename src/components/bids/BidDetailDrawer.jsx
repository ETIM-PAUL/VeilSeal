import { useEffect, useState } from "react";
import { Anchor, Badge, Button, Drawer, Group, Loader, Stack, Text } from "@mantine/core";
import { LuGavel, LuLock, LuTrophy, LuUndo2, LuShieldCheck, LuExternalLink, LuSparkles } from "react-icons/lu";

import BidThumbnail from "./BidThumbnail";
import { statusColor } from "../../utils/status";
import { getBidStatus, isRevealed, resolveWinner, formatCountdown, formatDeadline } from "../../utils/bids";
import {
  fetchOnChainListing,
  isContractConfigured,
  getVeilBiddingContract,
  getBrowserSigner,
  INSTRUCTION_FEE_WEI,
} from "../../contracts/VeilBidding";
import { truncateAddress, explorerTxUrl } from "../../utils/network";
import { fromChainAmount } from "../../utils/sealedBid";
import { requestAndRelayReveal } from "../../lib/tee/reveal";
import { isProxyConfigured } from "../../lib/tee/proxy";

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
  const [refreshTick, setRefreshTick] = useState(0);

  const [revealing, setRevealing] = useState(false);
  const [revealStepLabel, setRevealStepLabel] = useState("");
  const [revealError, setRevealError] = useState(null);

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
  }, [opened, onChainListingId, refreshTick]);

  const handleReveal = async () => {
    setRevealing(true);
    setRevealError(null);
    try {
      const signer = await getBrowserSigner();
      const contract = getVeilBiddingContract(signer);
      await requestAndRelayReveal(contract, onChainListingId, INSTRUCTION_FEE_WEI, setRevealStepLabel);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setRevealError(err?.reason ?? err?.message ?? "Failed to reveal listing.");
    } finally {
      setRevealing(false);
      setRevealStepLabel("");
    }
  };

  if (!bid) return null;

  const status = getBidStatus(bid);
  const revealed = isRevealed(bid, onChainData);
  const winner = revealed ? resolveWinner(bid, onChainData) : null;
  const iWon = winner?.mine;

  const sorted = [...bid.participants].sort((a, b) => {
    if (status === "Open") return 0;
    // Sealed (non-winning) amounts are never disclosed, so they're all 0 —
    // sort the revealed winner to the top instead of relying on that.
    if (winner) {
      const aIsWinner = a.wallet.toLowerCase() === winner.wallet.toLowerCase();
      const bIsWinner = b.wallet.toLowerCase() === winner.wallet.toLowerCase();
      if (aIsWinner !== bIsWinner) return aIsWinner ? -1 : 1;
    }
    return b.amount - a.amount;
  });

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="lg" title={bid.title}>
      <Stack mt="md">
        <BidThumbnail itemType={bid.itemType} previewUrl={bid.previewUrl} ipfsHash={bid.ipfsHash} height={180} />

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
              <Stack gap={8}>
                <Text size="xs" className="ink-dim">
                  Sealed bids are committed on Coston2. Once the deadline
                  passes, anyone can trigger the reveal — it routes every
                  sealed bid to the registered TEE, which decrypts them,
                  determines the winner, and signs the result.
                </Text>

                {status === "Closed" && isProxyConfigured() && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<LuSparkles size={13} />}
                    onClick={handleReveal}
                    loading={revealing}
                  >
                    {revealing ? revealStepLabel || "Revealing…" : "Request & Relay Reveal"}
                  </Button>
                )}

                {revealError && (
                  <Text size="xs" style={{ color: "var(--danger)" }}>
                    {revealError}
                  </Text>
                )}
              </Stack>
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
            const isWinner = Boolean(winner) && p.wallet.toLowerCase() === winner.wallet.toLowerCase();
            const canWithdraw = status === "Open" && p.mine && !p.withdrawn;
            // Only the TEE-attested winner's amount is ever disclosed on-chain —
            // everyone else's sealed bid stays hidden even after the deadline,
            // except to the bidder themselves. Local/mock (non-chain) listings
            // have no such reveal step, so they keep the old "show once closed" behavior.
            const showAmount = p.mine || (bid.onChainListingId ? isWinner : status === "Closed");

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
                  {showAmount ? (
                    <Text size="sm" fw={600} className="num">
                      {(isWinner ? winner.amount : p.amount).toLocaleString()} {bid.token}
                    </Text>
                  ) : (
                    <Group gap={4}>
                      <LuLock size={12} className="ink-faint" />
                      <Text size="sm" className="ink-faint">
                        Sealed
                      </Text>
                    </Group>
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
