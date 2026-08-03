import { ActionIcon, Group, Stack, Text } from "@mantine/core";
import { LuChevronUp, LuChevronDown, LuShuffle } from "react-icons/lu";

/// Guess-input control for a Cipher listing: an up/down reorder list rather
/// than drag-and-drop (no DnD dependency in this project, and an up/down
/// list is a valid permutation by construction - every swap keeps it one,
/// unlike per-word position dropdowns which need extra validation to prevent
/// two words claiming the same slot).
///
/// `words` is the listing's public word list; `arrangement` is the current
/// guess as an array of word-indices into `words` (arrangement[i] = the
/// original word-index placed at position i) - exactly the encoding used
/// on-chain, so no translation layer is needed before sealing the guess.
export default function WordArrangementInput({ words, arrangement, onChange }) {
  const swap = (i, j) => {
    const next = [...arrangement];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const shuffle = () => {
    // Client-side convenience only - a starting point for the user to refine,
    // not a source of on-chain randomness (the TEE's own derangement is).
    const next = [...arrangement];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    onChange(next);
  };

  return (
    <Stack gap={4}>
      <Group justify="flex-end">
        <ActionIcon variant="subtle" size="sm" onClick={shuffle} title="Shuffle starting order">
          <LuShuffle size={14} />
        </ActionIcon>
      </Group>

      <Stack gap={4}>
        {arrangement.map((wordIndex, position) => (
          <Group key={position} justify="space-between" className="panel" p={8} wrap="nowrap">
            <Group gap={8} wrap="nowrap">
              <Text size="xs" className="ink-faint num" w={20}>
                {position + 1}
              </Text>
              <Text size="sm" fw={500}>
                {words[wordIndex]}
              </Text>
            </Group>

            <Group gap={2}>
              <ActionIcon
                variant="subtle"
                size="sm"
                disabled={position === 0}
                onClick={() => swap(position, position - 1)}
              >
                <LuChevronUp size={14} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                size="sm"
                disabled={position === arrangement.length - 1}
                onClick={() => swap(position, position + 1)}
              >
                <LuChevronDown size={14} />
              </ActionIcon>
            </Group>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}
