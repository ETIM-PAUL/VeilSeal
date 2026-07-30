// Converts the real TEE's /info public key (x, y as separate 0x-prefixed
// 32-byte hex strings) into the flat 128-hex-char format eth-crypto's
// encryptWithPublicKey expects (x || y, no 0x, no leading 04 byte) — see
// src/utils/sealedBid.js's encryptBidTerms.
import { fetchTeeInfo } from "./proxy";

function stripHexPrefix(hex) {
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

export function formatTeePublicKey({ x, y }) {
  const xHex = stripHexPrefix(x).padStart(64, "0");
  const yHex = stripHexPrefix(y).padStart(64, "0");
  return xHex + yHex;
}

/// Fetches the live TEE's public key from the extension proxy, formatted for
/// use with encryptBidTerms(). Throws if VITE_EXT_PROXY_URL isn't configured
/// or the proxy is unreachable.
export async function fetchLiveTeePublicKey() {
  const info = await fetchTeeInfo();
  const publicKey = info.machineData?.publicKey;
  if (!publicKey?.x || !publicKey?.y) {
    throw new Error("TEE machine public key missing from /info response.");
  }
  return formatTeePublicKey(publicKey);
}
