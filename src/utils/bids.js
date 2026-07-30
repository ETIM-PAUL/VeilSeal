import { LuImage, LuVideo, LuMusic, LuFile } from "react-icons/lu";

export const ITEM_TYPES = [
  { value: "image", label: "Image", icon: LuImage },
  { value: "video", label: "Video", icon: LuVideo },
  { value: "audio", label: "Audio", icon: LuMusic },
  { value: "file", label: "File", icon: LuFile },
];

export const BID_TOKENS = ["FLR", "USDC", "ETH"];

export function itemTypeMeta(type) {
  return ITEM_TYPES.find((item) => item.value === type) ?? ITEM_TYPES[3];
}

export function getBidStatus(bid) {
  return Date.now() >= new Date(bid.deadline).getTime() ? "Closed" : "Open";
}

export function getWinner(bid) {
  const live = bid.participants.filter((p) => !p.withdrawn);
  if (live.length === 0) return null;
  return live.reduce((best, p) => (p.amount > best.amount ? p : best), live[0]);
}

export function formatCountdown(deadline) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Deadline passed";

  const mins = Math.floor(diff / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const remMins = mins % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${remMins}m left`;
  return `${remMins}m left`;
}

export function formatDeadline(deadline) {
  return new Date(deadline).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
