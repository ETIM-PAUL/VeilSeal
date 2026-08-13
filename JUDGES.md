<img src="public/readme-icon.png" width="72" height="72" alt="VeilSeal" />

# Testing VeilSeal — a guide for judges

VeilSeal doesn't need a permanently-running server to evaluate: the frontend runs locally against a **contract already deployed on Coston2**, and the confidential-compute (TEE) side of the flow is captured in the demo video, since that piece needs a Docker/tunnel stack we don't keep running 24/7 (see "What needs the TEE stack live" below).

## Demo video

[DEMO VIDEO LINK] — walks through creating a listing, sealing a bid, and the TEE-verified reveal for all three listing types.

## What's already live, no setup required

- **Contract**: `VeilBidding` at [`0x24ED14dD614B8D956eE81d2B73EF040989034980`](https://coston2-explorer.flare.network/address/0x24ED14dD614B8D956eE81d2B73EF040989034980) on **Flare Coston2** — registered against the live `FlareTeeManager` (`0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`). This address is baked into the frontend as the default ([`src/contracts/VeilBidding.js`](src/contracts/VeilBidding.js)), so no `.env` contract address is needed to browse listings, read history, or inspect state.
- All listing metadata (title, description, item type, minimum bid/score, invite lists) lives directly in contract storage — anyone can verify what's shown in the UI actually matches on-chain state via the block explorer link above, independent of our frontend.

## Run the frontend locally (~5 minutes)

```bash
git clone <this-repo>
cd VeilPay
npm install
npm run dev
```

Open the printed `localhost` URL. Connect a browser wallet (MetaMask or similar); if it isn't already on Coston2, add the network manually:

| Field | Value |
|---|---|
| Chain ID | `114` |
| RPC URL | `https://coston2-api.flare.network/ext/C/rpc` |
| Currency | `C2FLR` |
| Explorer | `https://coston2-explorer.flare.network` |

Get free testnet C2FLR from the [Coston2 faucet](https://faucet.flare.network/).

At this point you can:
- Browse existing **Standard Listings** on the Dashboard/Operations pages and inspect real on-chain bid/reveal/withdrawal activity.
- Create a new listing and submit a sealed bid yourself (the ciphertext is generated client-side; see [`src/lib/tee/ecies.js`](src/lib/tee/ecies.js)) — this exercises the full commitment scheme even without a live TEE, since sealing is a pure on-chain call.
- Read the contract directly via the explorer to confirm the frontend isn't showing you anything that isn't actually there.

## What needs the TEE stack live

The one step that can't complete without the TEE extension running is **reveal** (and score-gated eligibility checks) — the point where the enclave decrypts sealed bids, picks a winner, and signs the result `submitRevealResult` verifies on-chain. That backend ([`fce-veil-bid/`](fce-veil-bid/)) runs as a Docker stack + tunnel, which we don't keep up permanently — see [DEPLOYMENT_STEPS.md](fce-veil-bid/DEPLOYMENT_STEPS.md) for exactly how to stand it up (~15 min with Docker + Foundry + Go installed) if you'd like to trigger a live reveal and watch `submitRevealResult`'s `ecrecover` check pass on-chain yourself.

If a live endpoint happens to be up during the judging window, we'll share the URL separately — but the demo video is the primary way to see that flow end to end, and [`fce-veil-bid/contracts/InstructionSender.sol`](fce-veil-bid/contracts/InstructionSender.sol) plus [`fce-veil-bid/internal/extension/`](fce-veil-bid/internal/extension/) are there to verify the mechanism by reading rather than running it.

## Where to look for each claim

| Claim | Where to verify it |
|---|---|
| Bid amounts never appear on-chain in the clear | `submitSealedBid` in [`InstructionSender.sol`](fce-veil-bid/contracts/InstructionSender.sol) only stores a hash + ciphertext |
| TEE result is verified, not trusted | `submitRevealResult`'s `ecrecover` check against the registered `teeAddress`, same file |
| Signal score is computed from real on-chain signals | `computeScore` in [`fce-veil-bid/internal/extension/chain.go`](fce-veil-bid/internal/extension/chain.go) |
| Agent private keys never leave the enclave in the clear | ECIES encryption in [`src/pages/Agents.jsx`](src/pages/Agents.jsx) before the key is ever sent anywhere |
| Reproducible TEE Docker builds | [`fce-veil-bid/REPRODUCIBILITY.md`](fce-veil-bid/REPRODUCIBILITY.md) |
