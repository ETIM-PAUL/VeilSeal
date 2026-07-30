# VeilBidding Extension

A Flare Confidential Compute (FCC) extension that settles **sealed-bid auctions**. Bidders commit an on-chain hash plus an ECIES ciphertext of their true bid; only the TEE can decrypt it. After a listing's deadline, the TEE decrypts every sealed bid, determines the winner, and signs the result — the contract verifies that signature on-chain before recording the winner. Losing bid amounts are never reconstructed outside the enclave.

This is the backend for [VeilPay](../)'s sealed-bid feature — see [`../src/lib/tee/`](../src/lib/tee/) and [`../src/contracts/VeilBidding.js`](../src/contracts/VeilBidding.js) for the frontend integration.

## Quick start (local simulated on Coston2)

See **[DEPLOYMENT_STEPS.md](DEPLOYMENT_STEPS.md)** for the full walkthrough, including known gotchas. Summary:

```bash
# 1. Configure .env.local.coston2 (deployer key, TEE governance)
bash ./scripts/use-chain.sh local coston2

# 2. Deploy contract + register extension
bash ./scripts/pre-build.sh

# 3. ngrok http 6674 → set EXT_PROXY_URL in .env.local.coston2 → use-chain again
#    Use a reserved/named tunnel, not a rotating free one — see DEPLOYMENT_STEPS.md.

# 4. Indexer DB config (get credentials from Flare support) + Docker stack
cp config/proxy/extension_proxy.coston2.docker.toml.example \
   config/proxy/extension_proxy.coston2.docker.toml
# fill in [db] host/port/database/username/password, then:
docker compose -f docker-compose.yaml -f docker-compose.coston2.yaml up -d --build

# 5. On-chain TEE registration + end-to-end demo
bash ./scripts/post-build.sh
cd tools && go run ./cmd/run-test -instructionSender <deployed-address>
```

## Repository structure

```
├── cmd/                    # TEE entry (docker/main.go for container)
├── internal/extension/     # BID/REVEAL handler — decrypt, verify, pick winner
├── pkg/types/              # RevealMessage/RevealResult ABI types
├── contracts/              # VeilBidding (InstructionSender)
├── tools/                  # deploy, register-tee, run-test, settle (reveal keeper)
├── config/                 # chain addresses, proxy TOML examples
└── scripts/                # pre-build, start-services, post-build, use-chain
```

## Contract

`contracts/InstructionSender.sol` defines `VeilBidding`: `createListing`, `submitSealedBid` (pure on-chain commitment + ciphertext, no TEE round-trip needed), `requestReveal` (routes every sealed bid to the TEE in one FCC instruction), `submitRevealResult` (verifies the TEE's signature via `ecrecover` against the registered `teeAddress`).

This contract does not custody funds — it attests to *who won and at what amount*, verifiably and on-chain. Settlement (payment, refunds) is left to a consuming contract/flow.

## Environment variables

| Variable | Description |
|----------|-------------|
| `SIMULATED_TEE` | `true` for local Docker + ngrok; `false` for GCP Confidential Space VM |
| `EXT_PROXY_URL` | Reserved ngrok/cloudflared HTTPS URL (local) or devops proxy (deployed) |
| `GOVERNANCE_SIGNERS` / `GOVERNANCE_THRESHOLD` | TEE governance signer set; defaults to the deployer, threshold 1 |

Chain templates: `.env.coston2`, `.env.local.coston2`. Switch with `./scripts/use-chain.sh [local] <chain>`.

## Scripts

| Script | Purpose |
|--------|---------|
| `pre-build.sh` | Deploy `VeilBidding` + register extension |
| `extension-setup.sh` | Pre-Docker hook (currently a no-op for this extension) |
| `post-build.sh` | Allow TEE version + `register-tee rRap` |
| `extension-post-setup.sh` | `setTeeAddress` on contract from the registered TEE machine |
| `reveal-listing.sh` | Keeper: reveal one listing (`requestReveal` → poll TEE → `submitRevealResult`) |

## Prerequisites

- Docker Desktop, Go 1.25.1+, Foundry, a reserved-domain tunnel (ngrok static domain or named cloudflared tunnel)
- Funded Coston2 deployer key ([faucet](https://faucet.flare.network/))
- Coston2 indexer DB credentials (request via [Flare support](https://flare.network/resources/technical-support))

> Demonstration only. `teeAddress`/`SIMULATED_TEE=true` here is a governance-registered but non-attested TEE machine — production would run on GCP Confidential Space with real remote attestation.

## Related docs

- [DEPLOYMENT_STEPS.md](DEPLOYMENT_STEPS.md) — deployed vs local simulated flows, known gotchas
- [docs/testing.md](docs/testing.md) — unit tests and signature checks
- [docs/types-server.md](docs/types-server.md) — decode API for message/result payloads
