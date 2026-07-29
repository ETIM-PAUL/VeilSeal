// Central status → colour mapping so every table/badge in the app
// reads from the same restrained palette instead of Mantine's default hues.
export const STATUS_COLOR = {
  Completed: "signal",
  Settled: "signal",
  Healthy: "signal",
  Attested: "signal",
  Pending: "amber",
  Queued: "amber",
  Executing: "amber",
  Relayed: "slate",
  Failed: "danger",
  Open: "amber",
  Closed: "slate",
};

export function statusColor(status) {
  return STATUS_COLOR[status] ?? "slate";
}
