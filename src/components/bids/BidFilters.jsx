import { Group, Select, TextInput } from "@mantine/core";
import { LuSearch, LuFilter } from "react-icons/lu";

import { ITEM_TYPES } from "../../utils/bids";

const TYPE_OPTIONS = [
  { value: "All", label: "All Types" },
  ...ITEM_TYPES.map((t) => ({ value: t.value, label: t.label })),
];

const STATUS_OPTIONS = [
  { value: "All", label: "All Statuses" },
  { value: "Open", label: "Open" },
  { value: "Closed", label: "Closed" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "deadline-asc", label: "Deadline: Soonest" },
  { value: "deadline-desc", label: "Deadline: Latest" },
];

export default function BidFilters({ search, onSearch, type, onType, status, onStatus, sort, onSort }) {
  return (
    <Group>
      <TextInput
        placeholder="Search bids..."
        leftSection={<LuSearch size={15} />}
        value={search}
        onChange={(e) => onSearch(e.currentTarget.value)}
        w={220}
      />

      <Select
        leftSection={<LuFilter size={14} />}
        data={TYPE_OPTIONS}
        value={type}
        onChange={(v) => onType(v || "All")}
        w={150}
      />

      <Select
        data={STATUS_OPTIONS}
        value={status}
        onChange={(v) => onStatus(v || "All")}
        w={150}
      />

      <Select
        data={SORT_OPTIONS}
        value={sort}
        onChange={(v) => onSort(v || "newest")}
        w={180}
      />
    </Group>
  );
}
