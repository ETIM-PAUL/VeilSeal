<img src="public/readme-icon.png" width="72" height="72" alt="VeilSeal" />

# VeilSeal

VeilSeal is a confidential auction platform built on **Flare Confidential Compute (FCC)**. Bidders commit an encrypted, sealed amount on-chain; a TEE only decrypts sealed bids after a listing's deadline, determines the winner, and signs the result for on-chain verification — so nobody, including VeilSeal itself, ever sees a bid amount before it's revealed.

## The problem

Open, on-chain bidding leaks information the instant a bid lands in a mempool or a contract's storage: competitors see your number and outbid you by the smallest possible margin, front-runners and searchers can act on it before it settles, and sellers can rig thresholds after the fact. Sealing a bid off-chain with a normal server just moves the trust problem — now you have to trust the operator not to peek. VeilSeal removes that operator entirely: bid amounts are only ever readable inside a TEE enclave, at the one moment they need to be, and the enclave proves what it did with an on-chain-verifiable signature instead of asking to be believed.

## Selling points

- **True sealed-bid auctions, not "hidden until you refresh."** Every bid is an on-chain hash commitment plus an ECIES ciphertext that only the TEE's private key can open. The plaintext amount never appears in calldata, contract storage, or any off-chain database — not even VeilSeal's own.
- **On-chain verifiable reveals, no trusted operator.** After a listing's deadline, anyone can call `requestReveal`; the TEE decrypts every sealed bid for that listing, computes the winner, and signs a domain-separated result hash. `submitRevealResult` recovers the signer with `ecrecover` against a registered `teeAddress` and reverts if it doesn't match — the contract enforces the result, it doesn't take VeilSeal's word for it. Losing bid amounts are never reconstructed outside the enclave and never touch chain state.
- **Three distinct listing types, each solving a different privacy need:**
  - **Standard Listings** — publicly browsable, gated either by a TEE-verified minimum wallet signal score or by an explicit invite list, so the seller controls who can even place a bid.
  - **Stealth Listings** — encrypted end to end: title, description, item type, IPFS link, and minimum bid are all sealed, and the listing is discoverable only via a hashed ID the creator shares directly with invited bidders. Nothing about the listing is ever visible on-chain, even after the winner is revealed.
  - **Cipher Listings** — a skill-based challenge instead of a bid: invited participants predict how the TEE will secretly reorder the creator's word list, and the closest match wins. The TEE only ever originates the correct arrangement at reveal time, so there's no raffle-style predetermined answer sitting in state to be sniped.
- **Private, TEE-computed eligibility gating.** A wallet's "signal score" (0–100) is derived inside the enclave from three on-chain signals — current balance, transaction count, and prior sealed bids placed on this exact contract — combining sybil/spam resistance with platform-specific reputation. `requestScoreCheck` checks the score against a listing's minimum threshold *and* the sealed bid amount against the listing's minimum bid in a single round-trip, and returns a signed `EligibilityAttestation` bound to that specific bid's commitment (so it can't be replayed against a different amount). The wallet's actual score and bid amount are never revealed to the listing creator or anyone else — only pass/fail. A wallet can also privately query its own score at any time via `requestMyScore`, with no listing or threshold involved.
- **Agentic bidding.** Users can register an autonomous agent — its wallet private key encrypted directly to the TEE's public key, never stored or transmitted in the clear — with simple criteria (keyword, item type, max spend). The TEE runs the agent's bidding logic on the enclave's own schedule, entirely inside the trust boundary, so a user's key is never exposed to VeilSeal's servers or frontend.
- **Every admin/agent request is wallet-signed and replay-proof.** Agent-management and stealth-detail requests are authenticated with EIP-191 personal-sign messages that bind method + path + timestamp, with a short expiry window — a captured signature can't be replayed against a different route or reused later, and possession of a wallet's public address alone (visible on any invite list) is never enough to act on its behalf.
- **Fee-only settlement, no custody risk.** The contract never holds bid funds — it attests to *who won and at what amount*, verifiably and on-chain, and leaves payment/refund settlement to a consuming flow. That keeps the trusted surface area to exactly one thing: a signature check.
- **Live Operations feed.** A real-time feed of on-chain bid, reveal, and withdrawal activity across all listing types, so activity is auditable without needing to trust any single dashboard.
- **Reproducible, auditable TEE builds.** The extension's Docker image is bit-for-bit reproducible — `SOURCE_DATE_EPOCH`-clamped timestamps, `-trimpath`/stripped Go binaries, pinned base image digest, and Debian snapshot-pinned packages — so anyone can independently rebuild the exact image running inside the enclave and verify its digest matches what's deployed, rather than trusting a published binary blindly.

## Flare integration

VeilSeal's TEE backend ([`fce-veil-bid/`](fce-veil-bid/)) is a real **Flare Confidential Compute extension**, built directly on Flare's instruction/attested-result pattern rather than a generic off-chain service with a Flare label on it:

- The `VeilBidding` contract ([`fce-veil-bid/contracts/InstructionSender.sol`](fce-veil-bid/contracts/InstructionSender.sol)) doubles as the FCC `InstructionSender` — it owns the extension registration against `ITeeExtensionRegistry` and routes every `BID` / `SCORE` / `REVEAL` / `STEALTH_REVEAL` / `CIPHER` instruction through Flare's TEE Manager diamond, exactly like Flare's own reference extensions (e.g. Weather Insurance).
- Every TEE result — reveal, score check, stealth reveal, cipher reveal — is returned as a signed `ActionResult` and verified on-chain via `ecrecover` against a registered `teeAddress`, mirroring Flare's own `TEE_ACTION_RESULT` domain-separation scheme.
- The extension follows Flare's `internal/extension` handler pattern (Go), with dedicated `BID`/`REVEAL`/`SCORE`/`CIPHER` handlers, and ships both a `SIMULATED_TEE=true` local Docker + ngrok flow for development and a documented path to a real GCP Confidential Space VM with remote attestation for production.
- Frontend integration talks to the TEE proxy and extension directly (see [`src/lib/tee/`](src/lib/tee/) and [`src/contracts/VeilBidding.js`](src/contracts/VeilBidding.js)) — instruction submission, `ActionResult` polling, ECIES encryption to the TEE's public key, and signed request authentication are all implemented against Flare's actual FCC surface, not mocked.

## Technical execution

- Deployed and exercised end-to-end on **Coston2** (Flare testnet): contract deployment, extension registration, TEE registration, and a full bid → seal → reveal cycle all run against real Flare infrastructure via the documented [`DEPLOYMENT_STEPS.md`](fce-veil-bid/DEPLOYMENT_STEPS.md) flow.
- Clear separation of concerns: Solidity contract for commitments/attestation verification, a Go TEE extension for the confidential logic, and a React/Vite frontend — each with its own tests (`contracts/test/CipherListing.t.sol`, [`fce-veil-bid/docs/testing.md`](fce-veil-bid/docs/testing.md)) and no component blindly trusting another without a signature check in between.
- Item metadata (title, description, type, IPFS link, minimum bid) for standard listings is stored directly on-chain, so any client can render a listing from chain state alone with no off-chain indexer dependency for the core flow.

## Evidence of new work (built during the program)

Starting from a cloned Flare Weather Insurance extension as scaffolding, the following was built from scratch:
- The full `VeilBidding` sealed-bid contract and TEE extension (commitment scheme, BID/REVEAL handlers, on-chain signature verification)
- Score-gated and invite-only listing modes, with a TEE-computed wallet signal score and single-round-trip eligibility attestations
- Stealth Listings: fully encrypted listing metadata, hashed-ID discovery, and a dedicated authenticated `/stealth/{hashedId}/details` decrypt endpoint
- Cipher Listings end to end: contract support, TEE-generated word-arrangement reveal, and the frontend guess/reveal UI
- Agentic bidding: encrypted-key agent registration, signed agent-management API, and autonomous enclave-side bidding
- The live Operations feed and its on-chain activity aggregation
- Reproducible-build tooling for the TEE's Docker image

## What's next


- Deployment of app for public testing and working on feedback.
- Broadening the signal score's inputs beyond this contract's own history for stronger sybil resistance at cold-start.
