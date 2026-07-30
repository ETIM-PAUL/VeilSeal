// Direct browser upload to Pinata. VITE_PINATA_JWT is bundled into the
// public client JS — acceptable for this local/testnet demo, but note that
// anyone who inspects the built bundle can extract and reuse this token.
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";

export function isPinataConfigured() {
  return Boolean(PINATA_JWT);
}

export function ipfsGatewayUrl(cid) {
  return cid ? `${PINATA_GATEWAY}/${cid}` : "";
}

/// Uploads a File to Pinata and returns its IPFS CID.
export async function uploadFileToPinata(file) {
  if (!PINATA_JWT) {
    throw new Error("VITE_PINATA_JWT is not set — add it to .env to enable file uploads.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Pinata upload failed (${res.status}): ${text}`);
  }

  const body = JSON.parse(text);
  return body.IpfsHash;
}
