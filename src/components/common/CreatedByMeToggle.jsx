import { Switch, Tooltip } from "@mantine/core";

/// Shared "My Listings" filter control - a pure client-side filter over
/// already-fetched listing data (creator.toLowerCase() === address), used by
/// both the Standard and Cipher listings pages. Disabled (not hidden) when no
/// wallet is connected, since there's nothing to filter by yet.
export default function CreatedByMeToggle({ checked, onChange, disabled }) {
  return (
    <Tooltip label="Connect your wallet to filter" disabled={!disabled}>
      <Switch
        label="My Listings"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        disabled={disabled}
      />
    </Tooltip>
  );
}
