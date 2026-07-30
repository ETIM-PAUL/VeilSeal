# Weather Insurance Extension

A Flare Confidential Compute (FCC) extension that settles **parametric rainfall insurance** using weather data from [OpenWeatherMap](https://openweathermap.org/api) inside a TEE.

## Quick start (local simulated on Coston2)

See **[DEPLOYMENT_STEPS.md](DEPLOYMENT_STEPS.md)** for the full walkthrough. Summary:

```bash
# 1. Configure .env.local.coston2 (keys, OPENWEATHERMAP_API_KEY, PAY_TOKEN)
bash ./scripts/use-chain.sh local coston2

# 2. Deploy contract + register extension
bash ./scripts/pre-build.sh
bash ./scripts/extension-setup.sh

# 3. ngrok http 6674 → set EXT_PROXY_URL in .env.local.coston2 → use-chain again

# 4. Indexer DB config + Docker stack
cp config/proxy/extension_proxy.coston2.docker.toml.example \
   config/proxy/extension_proxy.coston2.docker.toml
bash ./scripts/start-services.sh

# 5. On-chain TEE registration + policy demo
bash ./scripts/post-build.sh
bash ./scripts/extension-post-setup.sh
bash ./scripts/test.sh

bash ./scripts/stop-services.sh
```

## Web frontend (Coston2)

dApp in [`frontend/`](frontend/) — wallet connect, buy policies (public or [ECIES](https://en.wikipedia.org/wiki/Elliptic-curve_cryptography) private), settle, and live weather FETCH. Private buys encrypt policy terms under the TEE public key inside FCC; see [docs/frontend-private-buy.md](docs/frontend-private-buy.md#ecies-and-flare-confidential-compute-fcc).

After the extension stack is running and `config/extension.env` exists:

```bash
cp frontend/.env.local.example frontend/.env.local
# Set NEXT_PUBLIC_WEATHER_INSURANCE from INSTRUCTION_SENDER
# EXT_PROXY_URL — for local UI use http://127.0.0.1:6674 (with start-services.sh).
# Use ngrok https URL only when the chain must reach your machine (see DEPLOYMENT_STEPS.md).
# If ngrok returns 404, fix the tunnel or rely on EXT_PROXY_LOCAL_URL fallback.

cd frontend && npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect MetaMask on **Coston2** (chain id 114), and fund **C2FLR** + **WPT** for premiums.

The UI proxies TEE `/info` and `/action/result` through Next API routes (`EXT_PROXY_URL` server-side) to avoid browser CORS. Optional types-server decode UI uses port **8100** (exposed from `extension-tee` in Docker Compose).

## Repository structure

```
├── cmd/                    # TEE entry (docker/main.go for container)
├── frontend/               # Next.js dApp (wagmi, Flare theme)
├── internal/extension/     # WEATHER FETCH / SETTLE / BUY handlers
├── pkg/types/              # Request/response types
├── contracts/              # WeatherInsurance (InstructionSender)
├── tools/                  # deploy, register-tee, run-test, settle
├── config/                 # chain addresses, proxy TOML examples
└── scripts/                # pre-build, start-services, test, use-chain
```

## Contract

`contracts/InstructionSender.sol` defines `WeatherInsurance`: `buyPolicy`, `buyPolicyPrivate`, `requestSettlement`, `settle`, `getWeather`, ERC-20 premiums/payouts via `PAY_TOKEN`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `OPENWEATHERMAP_API_KEY` | Required for TEE weather API calls |
| `PAY_TOKEN` | ERC-20 for premiums/payouts (`extension-setup.sh` → `setPayToken`) |
| `SIMULATED_TEE` | `true` for local Docker + ngrok; `false` for GCP VM |
| `EXT_PROXY_URL` | ngrok HTTPS URL (local) or devops proxy (deployed) |

Chain templates: `.env.coston2`, `.env.local.coston2` (and Coston variants). Switch with `./scripts/use-chain.sh [local] <chain>`.

## Scripts

| Script | Purpose |
|--------|---------|
| `pre-build.sh` | Deploy `WeatherInsurance` + register extension |
| `extension-setup.sh` | `setPayToken` on contract |
| `start-services.sh` | Docker: redis + ext-proxy + extension-tee |
| `post-build.sh` | Allow TEE version + `register-tee rRap` |
| `extension-post-setup.sh` | `setTeeAddress` on contract |
| `test.sh` | Full buy → settle policy demo |
| `settle-policy.sh` | Keeper settle for one policy ID |

## Prerequisites

- Docker Desktop, Go 1.25.1+, Foundry, ngrok (local flow)
- Funded Coston2 key + WPT for tests
- OpenWeatherMap API key

> Demonstration only — production would need multi-source oracles and stronger guarantees.

## Related docs

- [DEPLOYMENT_STEPS.md](DEPLOYMENT_STEPS.md) — deployed vs local simulated flows
- [docs/frontend-private-buy.md](docs/frontend-private-buy.md) — private buy UI flow and `relayPrivateBuy`
- [docs/frontend-weather-fetch.md](docs/frontend-weather-fetch.md) — `getWeather` TEE poll and JSON decode
- [docs/testing.md](docs/testing.md) — unit tests and signature checks
- [docs/types-server.md](docs/types-server.md) — decode API for the frontend activity panel
