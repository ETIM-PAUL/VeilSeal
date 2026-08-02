// Talks to the veilbidding extension's own /agent* HTTP API directly (port
// 7702, published to the host - see fce-veil-bid/docker-compose.yaml). Unlike
// /info and /decrypt (routed through ext-proxy's public tunnel so any
// bidder's browser can reach them), agent management is a local-admin
// surface: only the person running this dev environment needs to reach it,
// so it's published straight to localhost instead of needing a second public
// tunnel. CORS is handled server-side (internal/extension/agent_handlers.go).
//
// Every request is signed by the connected wallet (EIP-191 personal-sign) -
// the message binds method+path+timestamp so a captured signature can't be
// replayed against a different route or after 5 minutes, and so an attacker
// who merely knows a wallet's address (public on invite lists) can't toggle,
// delete, or trigger someone else's agent.
const AGENT_API_URL = (import.meta.env.VITE_AGENT_API_URL || "http://localhost:7702").replace(/\/$/, "");

async function signedRequest(signer, method, path, body) {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `VeilPayAgent:${method}:${path}:${timestamp}`;
  const signature = await signer.signMessage(message);

  const res = await fetch(`${AGENT_API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Timestamp": String(timestamp),
      "X-Agent-Signature": signature,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `${method} ${path} failed (${res.status})`);
  }
  return res.status === 204 || !text ? null : JSON.parse(text);
}

/// Registers (or wholesale replaces) this wallet's single v1 agent.
/// encryptedPrivateKey must already be ECIES ciphertext (see
/// src/lib/tee/goEcies.js) - the raw key is never sent in the clear.
export async function createAgent(signer, wallet, { encryptedPrivateKey, keyword, itemType, maxAmount }) {
  return signedRequest(signer, "POST", "/agent", { wallet, encryptedPrivateKey, keyword, itemType, maxAmount });
}

/// Returns null if no agent is registered for this wallet. Unauthenticated -
/// it's a read-only status check with no key material in the response, and
/// gating it would mean popping a signature prompt on every page load.
export async function getAgent(wallet) {
  const res = await fetch(`${AGENT_API_URL}/agent/${wallet}`);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `GET /agent/${wallet} failed (${res.status})`);
  }
  return res.status === 204 || !text ? null : JSON.parse(text);
}

/// Partial update - only provided fields change. Used for the
/// active/inactive toggle and editing criteria.
export async function updateAgent(signer, wallet, patch) {
  return signedRequest(signer, "PATCH", `/agent/${wallet}`, patch);
}

export async function deleteAgent(signer, wallet) {
  return signedRequest(signer, "DELETE", `/agent/${wallet}`);
}

/// Backs the "Run Now" button - synchronously evaluates this wallet's agent
/// against every open listing and returns the updated status.
export async function runAgentNow(signer, wallet) {
  return signedRequest(signer, "POST", `/agent/${wallet}/run`);
}
