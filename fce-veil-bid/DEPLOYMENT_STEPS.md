# VeilBidding extension — deployment

Sealed-bid auction TEE extension for Flare Coston2.

> **Two deployment modes.** The main path deploys to a **GCP Confidential Space VM**
> (production attestation, devops-hosted proxy). For development, run the TEE and
> proxy as **local Docker containers** with a **simulated** TEE (`SIMULATED_TEE=true`,
> `MODE=1`) exposed via a tunnel on the real chain — see
> [Local / simulated deployment](#local--simulated-deployment-docker--tunnel).

## Prerequisites

- Docker Desktop (Linux containers)
- Go 1.25.1+, Foundry (`forge`, `cast`), `jq`, `curl`
- A **reserved-domain tunnel** — an ngrok static domain or a named `cloudflared`
  tunnel. Do **not** use a rotating free tunnel (plain `ngrok http`, or
  `cloudflared tunnel --url` quick tunnels): Coston2 data providers push to the
  URL registered on-chain, and a rotated hostname leaves the TEE machine stuck
  at `INITIALIZED` with a dead URL. If the tunnel does rotate, update
  `EXT_PROXY_URL` and re-run `post-build.sh`.
- Funded deployer key on Coston2 — [faucet](https://faucet.flare.network/)
- Coston2 indexer DB credentials — request via
  [Flare support](https://flare.network/resources/technical-support) or
  [@flare_network](https://x.com/flare_network); credentials in older
  docs/examples are dead.

## Repository layout

No sibling `tee-node` / `tee-proxy` repos required — `go.mod` / `tools/go.mod`
pull versioned releases from GitHub.

```text
veilbidding/
├── cmd/ internal/ pkg/     # TEE extension (Go)
├── tools/                  # deploy, register-tee, run-test, settle
├── contracts/              # VeilBidding (InstructionSender)
├── scripts/
└── config/coston2/deployed-addresses.json
```

## 1. Configure environment

```bash
cp .env.example .env.coston2
cp .env.example .env.local.coston2
```

Set at minimum:

| Variable | Notes |
|----------|--------|
| `DEPLOYMENT_PRIVATE_KEY` | Funded key, no `0x` prefix |
| `INITIAL_OWNER` | Address from that key |

Activate:

```bash
bash ./scripts/use-chain.sh coston2          # deployed
bash ./scripts/use-chain.sh local coston2    # local simulated
```

> **Gotcha:** Foundry's `cast`/`forge` auto-load this directory's `.env` and
> map a `CHAIN` var to their own `--chain` flag. Our `CHAIN=coston2` doesn't
> match `cast`'s alias table (it wants `flare-coston2`), so any manual
> `cast call`/`cast send` from inside this repo needs an explicit
> `--chain flare-coston2` override or it errors with
> `invalid value 'coston2' for '--chain'`.

## 2. Register extension on-chain

```bash
bash ./scripts/pre-build.sh
```

Deploys `VeilBidding`, registers the extension, writes `config/extension.env`
(`EXTENSION_ID` + `INSTRUCTION_SENDER`). This step is pure on-chain contract
calls — no Docker or tunnel needed yet, and it's worth confirming it works
before touching anything else, since it isolates on-chain issues from
TEE/proxy issues.

> **Gotcha:** if `FlareTeeManager` is ever redeployed, existing registrations
> are wiped. Check `config/coston2/deployed-addresses.json`'s
> `FlareTeeManager` address against Flare's current announcement before
> debugging anything else — a stale address is the most common cause of
> `FunctionNotFound` or `register()` reverts. If it did change, re-run
> `pre-build.sh` for a fresh `EXTENSION_ID`; if your address already matches
> current, your registration should still be valid — confirm with:
> ```bash
> cast call <FlareTeeManager> "getTeeExtensionInstructionsSender(uint256)(address)" <extensionId> \
>   --rpc-url https://coston2-api.flare.network/ext/C/rpc --chain flare-coston2
> ```

## 3. Register TEE (deployed path)

After devops provides `EXT_PROXY_URL`, update `.env.coston2` and re-run `use-chain.sh`, then:

```bash
bash ./scripts/post-build.sh
bash ./scripts/extension-post-setup.sh   # setTeeAddress on VeilBidding
```

`post-build.sh` uses `register-tee -command rRap` (load-bearing for re-runs).

---

## Local / simulated deployment (Docker + tunnel)

Real Coston2 chain + simulated TEE in Docker, public proxy via a tunnel. No GCP VM.

### What `local` changes in `.env`

`use-chain.sh local coston2` copies `.env.local.coston2` → `.env`.

| Variable | Deployed | Local / simulated |
|----------|----------|-------------------|
| `SIMULATED_TEE` | `false` | `true` |
| `EXT_PROXY_URL` | devops URL | your reserved tunnel `https://…` URL |

`LOCAL_MODE` stays **`false`**. `MODE=1` is injected by `docker-compose.yaml` at runtime.

### Steps

1. **Activate local mode**

   ```bash
   bash ./scripts/use-chain.sh local coston2
   ```

2. **Pre-build**

   ```bash
   bash ./scripts/pre-build.sh
   ```

3. **Tunnel** (separate terminal) — host port `6674` → proxy `6664`. Start it
   *before* Docker, using a domain that won't change on restart:

   ```bash
   ngrok http 6674 --domain=<your-reserved-domain>
   # or: cloudflared tunnel run <your-named-tunnel>
   ```

   Set `EXT_PROXY_URL` in `.env.local.coston2` to that URL, then:

   ```bash
   bash ./scripts/use-chain.sh local coston2
   ```

4. **Indexer DB** — create `config/proxy/extension_proxy.coston2.docker.toml`
   from the `.example` file and fill in `[db]` with credentials from Flare
   support.

   > **macOS Docker Desktop gotcha:** bind-mounting a single host file to
   > `ext-proxy` can fail with `open ./config/config.toml: operation not
   > permitted` (EPERM) even though `stat` and Unix permissions look correct —
   > seen with both the gRPC-FUSE and VirtioFS file-sharing backends. If you
   > hit this, populate a named Docker volume instead of a host bind mount:
   > ```bash
   > docker volume create tee_proxy_config
   > docker run --rm -i -v tee_proxy_config:/data alpine sh -c "cat > /data/config.toml" \
   >   < config/proxy/extension_proxy.coston2.docker.toml
   > ```
   > and mount `tee_proxy_config:/app/config` in `docker-compose.yaml`'s
   > `ext-proxy` service instead of the bind-mounted file path (this repo's
   > `docker-compose.yaml` is already set up this way).

5. **Start the stack**

   ```bash
   docker compose -f docker-compose.yaml -f docker-compose.coston2.yaml up -d --build
   ```

   If a container was ever created against a network/volume that's since been
   removed or renamed, a stale network reference can make it fail to start
   even after retries — `docker compose down` then `up -d` again forces a
   clean recreate.

6. **Verify `/info`**

   ```bash
   curl -s "$EXT_PROXY_URL/info" | jq '.machineData'
   ```

   Simulated TEE: `codeHash` = `0x194844cf…`, `extensionId` matches
   `config/extension.env`, `initialOwner` matches your address.

7. **Register TEE**

   ```bash
   bash ./scripts/post-build.sh
   ```

   A healthy Coston2 stack reaches `PRODUCTION` status within seconds — the
   availability check is cosigned live by real Coston2 data providers. If
   registration hangs or the availability check keeps failing, suspect a
   stale `tee-node`/`tee-proxy` version first (see troubleshooting below)
   before assuming it's a chain-side problem.

8. **Run the end-to-end test**

   ```bash
   cd tools
   go run ./cmd/run-test -instructionSender <deployed-address> -amount 18000 -deadlineSecs 30
   ```

   Sequence: `setExtensionId()` → register the TEE address on-chain → create a
   listing → seal a bid (ECIES-encrypted under the live TEE's public key) →
   wait for the deadline → `requestReveal` → poll the proxy for the TEE's
   signed result → `submitRevealResult` → assert the on-chain winner and
   amount match what was sealed.

9. **Tear down**

   ```bash
   docker compose -f docker-compose.yaml -f docker-compose.coston2.yaml down
   ```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `cast call`/`cast send` errors `invalid value 'coston2' for '--chain'` | Pass `--chain flare-coston2` explicitly — `cast` auto-loads this directory's `.env` `CHAIN` var and doesn't recognize our alias for it. |
| `ext-proxy` panics with `open ./config/config.toml: operation not permitted` | macOS Docker file-sharing bug — use the named-volume workaround in step 4 above instead of a bind mount. |
| `ext-proxy` panics `dial tcp: lookup <indexer-db-host>: no such host` | Indexer credentials/host not filled in `[db]` — request them from Flare support. |
| Availability check never completes / TEE stuck at `INITIALIZED` | Pull latest `tee-node`/`tee-proxy`: `go get github.com/flare-foundation/tee-node@develop github.com/flare-foundation/tee-proxy@develop` (root and `tools/` modules), then `go mod tidy`. Older versions get every data-provider vote rejected. |
| `MachineManager.TooMany()` | `config/extension.env`'s extension ID doesn't match the on-chain TEE record — usually after a `FlareTeeManager` redeploy. Re-run `pre-build.sh` for a fresh extension ID. |
| `InvalidGovernanceHash` | `GOVERNANCE_SIGNERS`/`GOVERNANCE_THRESHOLD` don't match the governance hash the TEE node signed; leave both unset for the default deployer-only setup, or ensure `.env` and the container agree, then re-run `post-build.sh`. |
| `code hashes do not match` | `SIMULATED_TEE` and container `MODE` disagree; use `SIMULATED_TEE=true` with `MODE=1` (injected by Docker Compose). |
| TEE registration times out | `docker compose restart ext-proxy`; confirm Coston2 data providers are actually live before assuming the problem is client-side. |
| Tunnel URL changed | Update `EXT_PROXY_URL`, re-run `use-chain.sh`, restart the tunnel if needed, restart the Docker stack, re-run `post-build.sh`. |

### Fresh clone without re-minting

```bash
bash ./scripts/generate-bindings.sh
# Recover EXTENSION_ID from curl $EXT_PROXY_URL/info
# Recover INSTRUCTION_SENDER via:
#   cast call <FlareTeeManager> "getTeeExtensionInstructionsSender(uint256)(address)" <extensionId> \
#     --rpc-url https://coston2-api.flare.network/ext/C/rpc --chain flare-coston2
```

Then write `config/extension.env` and re-run `post-build.sh` / the end-to-end test.
