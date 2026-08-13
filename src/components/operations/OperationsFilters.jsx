import { Group, Select, TextInput } from "@mantine/core";
import { LuSearch, LuFilter } from "react-icons/lu";

const TYPE_OPTIONS = ["All", "Bid", "Listing", "Guess", "Cipher Listing"];
const DEFAULT_STATUS_OPTIONS = [
  "All",
  "Sealed",
  "Won",
  "Lost",
  "Withdrawn",
  "Open",
  "Awaiting Reveal",
  "Revealed",
  "No Bids",
];

export default function OperationsFilters({
  search,
  onSearch,
  type,
  onType,
  status,
  onStatus,
  statusOptions = DEFAULT_STATUS_OPTIONS,
}) {
  return (
    <Group>
      <TextInput
        placeholder="Search wallet..."
        leftSection={<LuSearch size={15} />}
        value={search}
        onChange={(e) => onSearch(e.currentTarget.value)}
        w={260}
      />

      <Select
        leftSection={<LuFilter size={14} />}
        data={TYPE_OPTIONS}
        value={type}
        onChange={(v) => onType(v || "All")}
        w={160}
      />

      <Select data={statusOptions} value={status} onChange={(v) => onStatus(v || "All")} w={160} />
    </Group>
  );
}
