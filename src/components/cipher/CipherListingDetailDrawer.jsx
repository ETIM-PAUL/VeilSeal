import { useEffect, useState } from "react";
import { Anchor, Badge, Button, Drawer, Group, Loader, Stack, Text, Textarea } from "@mantine/core";
import { LuLockKeyhole, LuPuzzle, LuShieldCheck, LuExternalLink, LuSparkles, LuUserPlus } from "react-icons/lu";

import BidThumbnail from "../bids/BidThumbnail";
import { statusColor } from "../../utils/status";
import { getBidStatus, formatCountdown, formatDeadline } from "../../utils/bids";
import {
  fetchCipherListingOnChain,
  fetchCipherGuessers,
  fetchCipherWinnerArrangement,
  fetchCipherTrueArrangement,
  fetchIsCipherParticipant,
  isContractConfigured,
  getVeilBiddingContract,
  getBrowserSigner,
  addCipherParticipants,
  INSTRUCTION_FEE_WEI,
} from "../../contracts/VeilBidding";
import { truncateAddress, explorerTxUrl } from "../../utils/network";
import { ipfsGatewayUrl } from "../../lib/pinata";
import { requestAndRelayCipherReveal } from "../../lib/tee/reveal";
import { isProxyConfigured } from "../../lib/tee/proxy";
import { useWallet } from "../../context/useWallet";
import CipherRevealResult from "./CipherRevealResult";

// The TEE returns its raw internal error string verbatim (see
// internal/extension/extension.go) - map the ones users can actually hit
// (nothing sealed before the deadline) to a properly-cased message instead
// of showing Go's lowercase, unpunctuated log line.
const KNOWN_REVEAL_ERRORS = {
  "no sealed guesses to reveal": "No sealed guesses to reveal.",
};

function formatRevealError(message) {
  return KNOWN_REVEAL_ERRORS[message] ?? message;
}

function parseParticipants(raw) {
  return raw
    .split(/[\s,]+/)
    .map((a) => a.trim())
    .filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a));
}

export default function CipherListingDetailDrawer({ opened, onClose, listing: liveListing, onSubmitGuess }) {
  const { address } = useWallet();
  // Keep the last known listing around so the drawer content stays in place
  // while it animates closed, instead of vanishing mid-transition.
  const [cachedListing, setCachedListing] = useState(liveListing);
  if (liveListing && liveListing !== cachedListing) {
    setCachedListing(liveListing);
  }
  const listing = liveListing ?? cachedListing;

  const [onChainData, setOnChainData] = useState(null);
  const [guessers, setGuessers] = useState([]);
  const [winnerArrangement, setWinnerArrangement] = useState(null);
  const [trueArrangement, setTrueArrangement] = useState(null);
  const [isParticipant, setIsParticipant] = useState(false);
  const [onChainLoading, setOnChainLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const [revealing, setRevealing] = useState(false);
  const [revealStepLabel, setRevealStepLabel] = useState("");
  const [revealError, setRevealError] = useState(null);

  const [participantsInput, setParticipantsInput] = useState("");
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [addParticipantsError, setAddParticipantsError] = useState(null);

  const onChainListingId = listing?.onChainListingId;

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(async () => {
      if (cancelled) return;

      if (!opened || !onChainListingId || !isContractConfigured()) {
        setOnChainData(null);
        return;
      }

      setOnChainLoading(true);
      try {
        const [data, guesserList, participant] = await Promise.all([
          fetchCipherListingOnChain(onChainListingId),
          fetchCipherGuessers(onChainListingId).catch(() => []),
          address ? fetchIsCipherParticipant(onChainListingId, address).catch(() => false) : Promise.resolve(false),
        ]);
        if (cancelled) return;

        setOnChainData(data);
        setGuessers(guesserList);
        setIsParticipant(participant);

        if (data?.revealed) {
          const [winnerArr, trueArr] = await Promise.all([
            fetchCipherWinnerArrangement(onChainListingId),
            fetchCipherTrueArrangement(onChainListingId),
          ]);
          if (!cancelled) {
            setWinnerArrangement(winnerArr);
            setTrueArrangement(trueArr);
          }
        } else {
          setWinnerArrangement(null);
          setTrueArrangement(null);
        }
      } catch {
        if (!cancelled) setOnChainData(null);
      } finally {
        if (!cancelled) setOnChainLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [opened, onChainListingId, address, refreshTick]);

  const handleReveal = async () => {
    setRevealing(true);
    setRevealError(null);
    try {
      const signer = await getBrowserSigner();
      const contract = getVeilBiddingContract(signer);
      await requestAndRelayCipherReveal(contract, onChainListingId, INSTRUCTION_FEE_WEI, setRevealStepLabel);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setRevealError(err?.reason ?? err?.message ?? "Failed to reveal listing.");
    } finally {
      setRevealing(false);
      setRevealStepLabel("");
    }
  };

  const handleAddParticipants = async () => {
    const addresses = parseParticipants(participantsInput);
    if (addresses.length === 0) {
      setAddParticipantsError("Enter at least one valid wallet address.");
      return;
    }

    setAddingParticipants(true);
    setAddParticipantsError(null);
    try {
      const signer = await getBrowserSigner();
      const contract = getVeilBiddingContract(signer);
      await addCipherParticipants(contract, onChainListingId, addresses);
      setParticipantsInput("");
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setAddParticipantsError(err?.reason ?? err?.message ?? "Failed to add participants.");
    } finally {
      setAddingParticipants(false);
    }
  };

  if (!listing) return null;

  const status = getBidStatus(listing);
  const revealed = onChainData?.revealed ?? false;
  const iWon = revealed && onChainData?.winner && address && onChainData.winner.toLowerCase() === address.toLowerCase();
  const isCreator = address && listing.creator?.toLowerCase() === address.toLowerCase();

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="lg" title={listing.title}>
      <Stack mt="md">
        <BidThumbnail itemType={listing.itemType} previewUrl={listing.previewUrl} ipfsHash={listing.ipfsHash} height={180} />

        <Group justify="space-between" align="flex-start">
          <Text className="caption" maw={420}>
            {listing.description}
          </Text>

          <Badge color={iWon ? "signal" : statusColor(status)}>{iWon ? "You Won" : status}</Badge>
        </Group>

        <Group gap={8}>
          <LuPuzzle size={14} className="ink-dim" />
          <Text size="xs" className="ink-dim">
            Skill-based challenge - closest word arrangement wins the item, not a raffle draw.
          </Text>
        </Group>

        <div className="panel" style={{ padding: 14 }}>
          <div className="label-micro">Word List</div>
          <Text size="sm" mt={4}>
            {listing.words.join(", ")}
          </Text>
        </div>

        {listing.ipfsHash && (
          <Anchor
            href={ipfsGatewayUrl(listing.ipfsHash)}
            target="_blank"
            rel="noreferrer"
            size="xs"
            className="num"
            style={{ wordBreak: "break-all" }}
          >
            <Group gap={4} wrap="nowrap">
              <span>IPFS: {listing.ipfsHash}</span>
              <LuExternalLink size={11} style={{ flexShrink: 0 }} />
            </Group>
          </Anchor>
        )}

        <Group grow>
          <div className="panel" style={{ padding: 14 }}>
            <div className="label-micro">Words</div>
            <div className="num-lg" style={{ marginTop: 4 }}>
              {listing.wordCount}
            </div>
          </div>

          <div className="panel" style={{ padding: 14 }}>
            <div className="label-micro">{status === "Open" ? "Time Left" : "Deadline"}</div>
            <div className="num-lg" style={{ marginTop: 4, fontSize: "1rem" }}>
              {status === "Open" ? formatCountdown(listing.deadline) : formatDeadline(listing.deadline)}
            </div>
          </div>
        </Group>

        <Group gap={6}>
          <LuLockKeyhole size={13} color="var(--amber)" />
          <Text size="sm" className="ink-dim">
            Invite only - only creator-invited wallets can submit a guess.
          </Text>
        </Group>

        {onChainListingId && (
          <div className="panel" style={{ padding: 14 }}>
            <Group gap={6} mb={onChainLoading || onChainData ? 10 : 0}>
              <LuShieldCheck size={13} color="var(--signal)" />
              <Text className="label-micro-strong">On-Chain Proof - Listing #{onChainListingId}</Text>
            </Group>

            {onChainLoading && <Loader size="xs" />}

            {!onChainLoading && onChainData?.revealed && (
              <Stack gap={10}>
                <Group justify="space-between">
                  <Text size="xs" className="ink-dim">
                    Winner
                  </Text>
                  <Text size="xs" fw={600} className="num">
                    {truncateAddress(onChainData.winner)}
                  </Text>
                </Group>

                {winnerArrangement && trueArrangement && (
                  <CipherRevealResult
                    words={listing.words}
                    winnerArrangement={winnerArrangement}
                    trueArrangement={trueArrangement}
                  />
                )}

                {onChainData.txHash && (
                  <Anchor href={explorerTxUrl(onChainData.txHash)} target="_blank" rel="noreferrer" size="xs">
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
                {status === "Closed" && guessers.length === 0 ? (
                  <Text size="xs" className="ink-dim">
                    No sealed guesses were submitted before the deadline - there&apos;s nothing to reveal.
                  </Text>
                ) : (
                  <Text size="xs" className="ink-dim">
                    Sealed guesses are committed on Coston2. Once the deadline
                    passes, anyone can trigger the reveal - the TEE generates
                    its true arrangement fresh, scores every guess, and signs
                    the result.
                  </Text>
                )}

                {status === "Closed" && guessers.length > 0 && isProxyConfigured() && (
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
                    {formatRevealError(revealError)}
                  </Text>
                )}
              </Stack>
            )}

            {!onChainLoading && !onChainData && (
              <Text size="xs" className="ink-faint">
                On-chain data unavailable - contract not configured or unreachable.
              </Text>
            )}
          </div>
        )}

        {status === "Open" && isParticipant && (
          <Button leftSection={<LuPuzzle size={15} />} onClick={() => onSubmitGuess(listing.id)}>
            Submit Sealed Guess
          </Button>
        )}

        {status === "Open" && !isParticipant && !isCreator && (
          <Text size="xs" className="ink-faint">
            You haven&apos;t been invited to guess on this listing.
          </Text>
        )}

        {status === "Open" && isCreator && (
          <div className="panel" style={{ padding: 14 }}>
            <Group gap={6} mb={8}>
              <LuUserPlus size={13} />
              <Text className="label-micro-strong">Invite Participants</Text>
            </Group>

            <Text size="xs" className="ink-dim" mb={8}>
              Invited addresses can submit a sealed guess. The word list
              itself is already public to everyone.
            </Text>

            <Textarea
              placeholder="0xabc..., 0xdef..."
              minRows={2}
              autosize
              value={participantsInput}
              onChange={(e) => setParticipantsInput(e.currentTarget.value)}
              mb={8}
            />

            {addParticipantsError && (
              <Text size="xs" mb={8} style={{ color: "var(--danger)" }}>
                {addParticipantsError}
              </Text>
            )}

            <Button
              size="xs"
              variant="light"
              leftSection={<LuUserPlus size={13} />}
              onClick={handleAddParticipants}
              loading={addingParticipants}
            >
              Add Participants
            </Button>
          </div>
        )}

        <div className="hairline-top" style={{ marginTop: 4 }} />

        <Text className="label-micro-strong">Guesses Submitted ({guessers.length})</Text>

        <Stack gap={0}>
          {guessers.length === 0 && (
            <Text className="caption" py="md">
              No sealed guesses submitted.
            </Text>
          )}

          {guessers.map((wallet, index) => {
            const isWinner = revealed && onChainData?.winner?.toLowerCase() === wallet.toLowerCase();
            return (
              <Group
                key={wallet}
                justify="space-between"
                py={10}
                className={index !== guessers.length - 1 ? "hairline-bottom" : ""}
                style={{
                  background: isWinner ? "var(--signal-bg)" : "transparent",
                  paddingLeft: isWinner ? 10 : 0,
                  paddingRight: isWinner ? 10 : 0,
                  borderRadius: isWinner ? 4 : 0,
                }}
              >
                <Text size="sm" fw={600} className="num">
                  {wallet}
                  {address && wallet.toLowerCase() === address.toLowerCase() && (
                    <span className="label-micro" style={{ marginLeft: 8 }}>
                      You
                    </span>
                  )}
                </Text>

                {isWinner ? (
                  <Badge color="signal">Winner</Badge>
                ) : (
                  <Group gap={4}>
                    <LuLockKeyhole size={12} className="ink-faint" />
                    <Text size="sm" className="ink-faint">
                      Sealed
                    </Text>
                  </Group>
                )}
              </Group>
            );
          })}
        </Stack>
      </Stack>
    </Drawer>
  );
}
