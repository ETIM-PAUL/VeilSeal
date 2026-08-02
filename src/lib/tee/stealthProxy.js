// Talks to the veilbidding extension's own /stealth/{hashedId}/details HTTP
// endpoint directly (same host:port as /agent* - see fce-veil-bid's
// docker-compose.yaml, "extension-tee" published straight to localhost, not
// routed through ext-proxy's public tunnel). This is a synchronous signed-
// request/response exchange, not an FCC instruction - there's no on-chain
// instruction fee, no relay transaction, no ActionResult polling, because
// nothing here ever needs a smart contract to later verify it happened.
//
// The request is signed by the connected wallet (EIP-191 personal-sign) -
// the message binds method+path+timestamp, mirroring agentProxy.js, so a
// captured signature can't be replayed against a different route or after
// it expires. The TEE recovers the signer from the signature itself (there's
// no separate "wallet" argument to check it against, unlike /agent/{wallet}/*)
// and only decrypts if that recovered address is on the listing's
// participant allowlist.
const AGENT_API_URL = (import.meta.env.VITE_AGENT_API_URL || "http://localhost:7702").replace(/\/$/, "");

/// Requests a stealth listing's decrypted details. Returns
/// { title, description, itemType, ipfsHash, minBid, nonce } - the plaintext
/// the creator originally encrypted with encryptStealthDetails. Throws if the
/// listing doesn't exist or the connected wallet isn't a participant.
export async function fetchStealthDetails(signer, hashedId) {
  const path = `/stealth/${hashedId}/details`;
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `VeilPayStealth:POST:${path}:${timestamp}`;
  const signature = await signer.signMessage(message);

  const res = await fetch(`${AGENT_API_URL}${path}`, {
    method: "POST",
    headers: {
      "X-Stealth-Timestamp": String(timestamp),
      "X-Stealth-Signature": signature,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `POST ${path} failed (${res.status})`);
  }
  return JSON.parse(text);
}
