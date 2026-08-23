import { useMemo, useState } from "react";
import { Button, Group, Loader, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { LuPlus, LuPuzzle, LuRefreshCw, LuSearch } from "react-icons/lu";
import { useDisclosure } from "@mantine/hooks";

import CipherListingCard from "../components/cipher/CipherListingCard";
import NewCipherListingDrawer from "../components/cipher/NewCipherListingDrawer";
import SubmitGuessDrawer from "../components/cipher/SubmitGuessDrawer";
import CipherListingDetailDrawer from "../components/cipher/CipherListingDetailDrawer";
import CreatedByMeToggle from "../components/common/CreatedByMeToggle";
import EmptyState from "../components/common/EmptyState";

import { useCipherListings } from "../context/useCipherListings";
import { useWallet } from "../context/useWallet";

export default function CipherListings() {
  // Cipher listings live in CipherListingsContext (mounted once, above the
  // router) so navigating away from /cipher-listings and back doesn't
  // re-fetch or re-flash the skeleton - mirrors Bids.jsx/BidsContext exactly.
  const { listings, loading: chainLoading, error: chainError, refresh, createCipherListing } = useCipherListings();
  const { address, isConnected } = useWallet();

  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const [newOpened, { open: openNew, close: closeNew }] = useDisclosure(false);
  const [guessListingId, setGuessListingId] = useState(null);
  const [detailListingId, setDetailListingId] = useState(null);

  const filtered = useMemo(() => {
    return listings
      .filter((l) => l.title?.toLowerCase().includes(search.toLowerCase()))
      .filter((l) => !mineOnly || (address && l.creator?.toLowerCase() === address.toLowerCase()))
      .sort((a, b) => Number(b.onChainListingId) - Number(a.onChainListingId));
  }, [listings, search, mineOnly, address]);

  const guessTarget = listings.find((l) => l.id === guessListingId);
  const detailTarget = listings.find((l) => l.id === detailListingId);
  const initialLoad = chainLoading && listings.length === 0;

  return (
    <>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Cipher Listings</Title>

            <Text className="caption" mt={4}>
              Skill-based challenges resolved through Flare Confidential
              Compute - closest arrangement wins, not a raffle draw.
            </Text>
          </div>

          <Group gap="sm">
            <Button
              variant="subtle"
              size="sm"
              leftSection={chainLoading ? <Loader size={13} /> : <LuRefreshCw size={15} />}
              onClick={refresh}
              disabled={chainLoading}
            >
              Refresh
            </Button>

            <Button leftSection={<LuPlus size={15} />} onClick={openNew}>
              New Cipher Listing
            </Button>
          </Group>
        </Group>

        {chainError && (
          <Text size="sm" style={{ color: "var(--danger)" }}>
            {chainError}
          </Text>
        )}

        <Group justify="space-between">
          <TextInput
            placeholder="Search items..."
            leftSection={<LuSearch size={15} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={220}
          />

          <CreatedByMeToggle checked={mineOnly} onChange={setMineOnly} disabled={!isConnected} />
        </Group>

        {initialLoad ? (
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="panel" style={{ padding: 16, height: 160 }} />
            ))}
          </SimpleGrid>
        ) : filtered.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={LuPuzzle}
              title="No cipher listings found"
              description="Try adjusting your filters, or create a new cipher listing."
            />
          </div>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }}>
            {filtered.map((listing) => (
              <CipherListingCard key={listing.id} listing={listing} onOpen={setDetailListingId} />
            ))}
          </SimpleGrid>
        )}
      </Stack>

      <NewCipherListingDrawer opened={newOpened} onClose={closeNew} onCreate={createCipherListing} />

      <SubmitGuessDrawer
        opened={!!guessListingId}
        onClose={() => setGuessListingId(null)}
        listing={guessTarget}
        onSubmit={() => refresh()}
      />

      <CipherListingDetailDrawer
        opened={!!detailListingId}
        onClose={() => setDetailListingId(null)}
        listing={detailTarget}
        onSubmitGuess={(id) => {
          setDetailListingId(null);
          setGuessListingId(id);
        }}
      />
    </>
  );
}
