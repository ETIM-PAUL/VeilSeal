import { Divider, Group, Stack, Text } from "@mantine/core";
import { LuTrophy } from "react-icons/lu";

/// Renders the winner's own arrangement alongside the TEE's true arrangement
/// and computes the match count client-side - the signed result never
/// carries a match-count field, both revealed arrays are enough to derive it.
export default function CipherRevealResult({ words, winnerArrangement, trueArrangement }) {
  if (!winnerArrangement?.length || !trueArrangement?.length) return null;

  const matchCount = winnerArrangement.filter((v, i) => v === trueArrangement[i]).length;

  return (
    <Stack gap={10}>
      <Group gap={6}>
        <LuTrophy size={14} color="var(--signal)" />
        <Text className="label-micro-strong">
          {matchCount} of {trueArrangement.length} matched
        </Text>
      </Group>

      <Group grow align="flex-start">
        <Stack gap={4}>
          <Text size="xs" className="ink-dim">
            Winner&apos;s Arrangement
          </Text>
          {winnerArrangement.map((wordIndex, position) => (
            <Text
              key={position}
              size="sm"
              fw={winnerArrangement[position] === trueArrangement[position] ? 700 : 400}
              style={{
                color:
                  winnerArrangement[position] === trueArrangement[position] ? "var(--signal-ink)" : undefined,
              }}
            >
              {words[wordIndex]}
            </Text>
          ))}
        </Stack>

        <Divider orientation="vertical" />

        <Stack gap={4}>
          <Text size="xs" className="ink-dim">
            TEE&apos;s True Arrangement
          </Text>
          {trueArrangement.map((wordIndex, position) => (
            <Text
              key={position}
              size="sm"
              fw={winnerArrangement[position] === trueArrangement[position] ? 700 : 400}
              style={{
                color:
                  winnerArrangement[position] === trueArrangement[position] ? "var(--signal-ink)" : undefined,
              }}
            >
              {words[wordIndex]}
            </Text>
          ))}
        </Stack>
      </Group>
    </Stack>
  );
}
