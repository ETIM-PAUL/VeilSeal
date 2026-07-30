// Talks to the real FCC extension proxy (fce-veil-bid's ext-proxy service),
// once one is deployed and reachable. The proxy doesn't send CORS headers,
// so a direct browser fetch to its origin is blocked — in dev, Vite's
// server.proxy rewrites requests to `/tee-proxy/*` into same-origin calls
// (see vite.config.js). A production static deployment would need an
// equivalent server-side proxy, since this dev proxy doesn't exist in a
// built bundle.
const EXT_PROXY_URL = import.meta.env.VITE_EXT_PROXY_URL;
const BASE_PATH = import.meta.env.DEV && EXT_PROXY_URL ? "/tee-proxy" : EXT_PROXY_URL;

function requireProxyUrl() {
  if (!EXT_PROXY_URL) {
    throw new Error("VITE_EXT_PROXY_URL is not set — point it at a running ext-proxy (e.g. your ngrok URL).");
  }
  return BASE_PATH.replace(/\/$/, "");
}

async function parseJsonResponse(res, label) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label} failed (${res.status}): ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `${label} returned non-JSON — likely misconfigured proxy (check VITE_EXT_PROXY_URL and, in dev, vite.config.js's server.proxy).`
    );
  }
}

/// GET /info — returns the TEE machine's public key (for ECIES encryption)
/// and identity data. Shape: { teeInfo: { publicKey: {x,y} }, machineData: { publicKey: {x,y} }, proxySignature }
export async function fetchTeeInfo() {
  const res = await fetch(`${requireProxyUrl()}/info`);
  return parseJsonResponse(res, "TEE info");
}

/// GET /action/result/:instructionId — polls for a completed ActionResult.
/// Shape: { result: { data, id, submissionTag, status, log? }, signature }
export async function pollActionResult(instructionId, { intervalMs = 2000, timeoutMs = 120000 } = {}) {
  const url = `${requireProxyUrl()}/action/result/${instructionId.replace(/^0x/, "")}`;
  const start = Date.now();

  while (true) {
    const res = await fetch(url);
    if (res.ok) {
      const body = await parseJsonResponse(res, "Action result");
      if (body.result.status !== 2) return body; // 2 = still processing
    } else if (res.status !== 404) {
      await parseJsonResponse(res, "Action result"); // throws with the response body
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for instruction ${instructionId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/// Destructures the fields VeilBidding.submitRevealResult expects, in order.
export function actionResultFields(resp) {
  const { data, id, submissionTag, status } = resp.result;
  return { data, actionId: id, submissionTag, status, signature: resp.signature };
}

export function isProxyConfigured() {
  return Boolean(EXT_PROXY_URL);
}
