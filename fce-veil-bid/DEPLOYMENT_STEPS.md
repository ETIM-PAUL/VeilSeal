# Weather-insurance extension — deployment

Parametric rainfall insurance TEE extension for Flare Coston / Coston2.

> **Two deployment modes.** The main path deploys to a **GCP Confidential Space VM**
> (production attestation, devops-hosted proxy). For development, run the TEE and
> proxy as **local Docker containers** with a **simulated** TEE (`SIMULATED_TEE=true`,
> `MODE=1`) exposed via **ngrok** on the real chain — see
> [Local / simulated deployment](#local--simulated-deployment-docker--ngrok).

## Prerequisites

- Docker Desktop (Linux containers)
- Go 1.25.1+, Foundry (`forge`, `cast`), `jq`, `curl`
- **OpenWeatherMap API key** — set `OPENWEATHERMAP_API_KEY` in `.env` before `start-services.sh`
- **ngrok** — for the local / simulated flow only
- Funded deployer key on Coston2 (and WPT for `test.sh` payouts) — [faucet](https://faucet.flare.network/coston2)
- **VPN** — only for Coston (VPN-gated indexer)

## Indexer DB credentials

The `ext-proxy` reads Flare's indexer DB. Create the chain-specific docker config (gitignored) from the example:

```bash
cp config/proxy/extension_proxy.coston2.docker.toml.example \
   config/proxy/extension_proxy.coston2.docker.toml
```

Fill `[db]` per chain — see the example file and the sign extension doc for Coston2/Coston host credentials. Wrong or missing DB config causes `test.sh` to fail the round-trip.

## Repository layout

No sibling `tee-node` / `tee-proxy` repos required. The extension `Dockerfile`, root `go.mod`, and `tools/` pull pinned versions from GitHub (`tee-node v0.0.20`, `tee-proxy v0.0.17` in `tools/go.sum`).

```text
extensions/weather-insurance/
├── cmd/ internal/ pkg/     # TEE extension (Go)
├── tools/                  # deploy, register-tee, run-test
├── contracts/              # WeatherInsurance (InstructionSender)
├── scripts/
└── config/coston2/deployed-addresses.json
```

## 1. Configure environment

Copy and edit chain templates (or start from `.env.example`):

```bash
cp .env.example .env.coston2
cp .env.example .env.local.coston2
```

Set at minimum:

| Variable | Notes |
|----------|--------|
| `DEPLOYMENT_PRIVATE_KEY` | Funded key, no `0x` prefix |
| `INITIAL_OWNER` | Address from that key |
| `OPENWEATHERMAP_API_KEY` | From [openweathermap.org](https://openweathermap.org/api) |
| `PAY_TOKEN` | Coston2 WPT: `0x53192e788991AD96bC180249B15AefB94E597dD1` |

Activate:

```bash
bash ./scripts/use-chain.sh coston2          # deployed
bash ./scripts/use-chain.sh local coston2  # local simulated
```

## 2. Register extension on-chain

```bash
bash ./scripts/pre-build.sh
```

Deploys `WeatherInsurance`, registers the extension, writes `config/extension.env`.

Policy location is chosen at buy time (City,CC geocoded to lat/lon). After contract changes, re-run `pre-build.sh` and copy the new ABI into `frontend/lib/abi/weatherInsurance.json` (or run `scripts/generate-bindings.sh` and `jq` as in that script).

Then wire the pay token (before Docker):

```bash
bash ./scripts/extension-setup.sh
```

## 3. Register TEE (deployed path)

After devops provides `EXT_PROXY_URL`, update `.env.coston2` and re-run `use-chain.sh`, then:

```bash
bash ./scripts/post-build.sh
bash ./scripts/extension-post-setup.sh   # setTeeAddress on WeatherInsurance
bash ./scripts/test.sh
```

`post-build.sh` uses `register-tee -command rRap` (load-bearing for re-runs).

---

## Local / simulated deployment (Docker + ngrok)

Real Coston2 chain + simulated TEE in Docker, public proxy via ngrok. No GCP VM.

### What `local` changes in `.env`

`use-chain.sh local coston2` copies `.env.local.coston2` → `.env`.

| Variable | Deployed | Local / simulated |
|----------|----------|-------------------|
| `SIMULATED_TEE` | `false` | `true` |
| `EXT_PROXY_URL` | devops URL | your ngrok `https://…` URL |

`LOCAL_MODE` stays **`false`**. `MODE=1` is injected by `docker-compose.yaml` at runtime.

### Steps

1. **Activate local mode**

   ```bash
   bash ./scripts/use-chain.sh local coston2
   ```

2. **Pre-build + extension setup**

   ```bash
   bash ./scripts/pre-build.sh
   bash ./scripts/extension-setup.sh
   ```

3. **ngrok** (host port `6674` → proxy `6664`)

   ```bash
   ngrok http 6674
   ```

   Set `EXT_PROXY_URL` in `.env.local.coston2` to the `Forwarding` HTTPS URL, then:

   ```bash
   bash ./scripts/use-chain.sh local coston2
   ```

4. **Indexer DB** — create `config/proxy/extension_proxy.coston2.docker.toml` (see above).

5. **Start stack**

   ```bash
   bash ./scripts/start-services.sh
   ```

6. **Verify `/info`** (simulated `codeHash` ≈ `0x194844cf…`)

   ```bash
   curl -s "$EXT_PROXY_URL/info" | jq '.machineData'
   ```

7. **Register TEE and test**

   ```bash
   bash ./scripts/post-build.sh
   bash ./scripts/extension-post-setup.sh
   bash ./scripts/test.sh
   ```

8. **Tear down**

   ```bash
   bash ./scripts/stop-services.sh
   ```

> Re-run after code changes: keep ngrok up, `start-services.sh`, then `post-build.sh` / `test.sh` as needed.

## End-to-end test

`test.sh` runs `tools/cmd/run-test`: fund pool, private buy, settlement against OpenWeatherMap, assert payout. The deployer needs WPT balance on Coston2.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `OPENWEATHERMAP_API_KEY is not set` in TEE logs | Set in `.env`, re-run `start-services.sh` |
| `Post "http://localhost:7702/action": context deadline exceeded` on settle | tee-node allows only **2s** for synchronous extension responses; settlement calls OpenWeatherMap One Call `day_summary` (often slower). Rebuild `extension-tee` after pulling fixes (async SETTLE/FETCH + longer OWM timeout). Ensure the API key has a [One Call subscription](https://openweathermap.org/api/one-call-3). |
| `test.sh` round-trip fails | Check indexer `[db]` in docker proxy config; confirm `EXT_PROXY_URL` is ngrok HTTPS (not localhost) on Coston2 |
| `MachineManager.TooMany()` | `INSTRUCTION_SENDER` / `EXTENSION_ID` mismatch — re-run `pre-build.sh --force` only if intentional |
| `code hashes do not match` | `SIMULATED_TEE` must match TEE `MODE` (simulated: `SIMULATED_TEE=true`, compose `MODE=1`) |

### Fresh clone without re-minting

```bash
bash ./scripts/generate-bindings.sh
# Recover EXTENSION_ID from curl $EXT_PROXY_URL/info
# Recover INSTRUCTION_SENDER via cast call FlareTeeManager getTeeExtensionInstructionsSender
```

Then write `config/extension.env` and run `post-build.sh` / `test.sh`.
