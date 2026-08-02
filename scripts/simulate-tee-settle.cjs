// Stands in for the "TEE machine" half of the FCC architecture: watches
// on-chain listings, and once a deadline passes, decrypts every sealed bid,
// determines the winner, and submits a domain-separated signed result.
//
// TEE_PRIVATE_KEY only ever lives here (a Node process you run yourself) -
// it is never bundled into the frontend. In real Flare Confidential Compute
// this logic runs inside attested hardware instead of a plain Node script;
// this is a hackathon-scoped simulation of that trust boundary, not a claim
// of real enclave attestation.
//
// Requires `npx hardhat compile` to have been run at least once (reads the
// ABI from artifacts/).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { JsonRpcProvider, Wallet, Contract } = require("ethers");
const artifact = require("../artifacts/contracts/VeilBidding.sol/VeilBidding.json");
const {
  decryptBidTerms,
  computeTermsCommitment,
  computeResultHash,
  computeSignedHash,
  signResult,
} = require("./lib/sealedBidCrypto.cjs");

const RPC_URL = process.env.COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
const CONTRACT_ADDRESS = process.env.VITE_VEILBIDDING_ADDRESS;
const RELAYER_KEY = process.env.PRIVATE_KEY;
const TEE_PRIVATE_KEY = process.env.TEE_PRIVATE_KEY;
const POLL_MS = 8000;

function log(msg) {
  console.log(`[TEE] ${new Date().toISOString()} ${msg}`);
}

async function settleListing(contract, chainId, listingId) {
  const listing = await contract.listings(listingId);
  if (listing.deadline === 0n || listing.revealed) return;

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < listing.deadline) return;

  log(`Listing ${listingId}: deadline passed, requesting reveal...`);

  try {
    const reqTx = await contract.requestReveal(listingId);
    await reqTx.wait();
  } catch {
    // Someone else may have already requested it - not an error for us.
  }

  const bidders = await contract.getBidders(listingId);
  if (bidders.length === 0) {
    log(`Listing ${listingId}: no bidders, nothing to settle.`);
    return;
  }

  log(`Listing ${listingId}: decrypting ${bidders.length} sealed bid(s) inside the (simulated) enclave...`);

  let winner = null;
  let winningAmount = 0n;

  for (const bidder of bidders) {
    const sealed = await contract.sealedBids(listingId, bidder);
    if (!sealed.submitted) continue;

    let decrypted;
    try {
      decrypted = await decryptBidTerms(sealed.encryptedTerms, TEE_PRIVATE_KEY);
    } catch (err) {
      log(`  ${bidder}: FAILED to decrypt - ${err.message}`);
      continue;
    }

    const recomputed = computeTermsCommitment(decrypted);
    if (recomputed !== sealed.termsCommitment) {
      log(`  ${bidder}: commitment mismatch - rejecting this bid.`);
      continue;
    }

    log(`  ${bidder}: valid sealed bid decrypted (amount withheld from this log by design).`);

    if (winner === null || decrypted.amount > winningAmount) {
      winner = bidder;
      winningAmount = decrypted.amount;
    }
  }

  if (winner === null) {
    log(`Listing ${listingId}: no valid bids after decryption, skipping.`);
    return;
  }

  const resultHash = computeResultHash({ contractAddress: contract.target, listingId, winner, winningAmount });
  const signedHash = computeSignedHash({ contractAddress: contract.target, chainId, listingId, resultHash });
  const signature = await signResult(signedHash, TEE_PRIVATE_KEY);

  log(`Listing ${listingId}: winner determined, submitting TEE-signed result on-chain...`);

  const tx = await contract.submitRevealResult(listingId, winner, winningAmount, resultHash, signature);
  const receipt = await tx.wait();

  log(`Listing ${listingId}: settled. tx=${receipt.hash}`);
}

async function main() {
  if (!CONTRACT_ADDRESS) throw new Error("Set VITE_VEILBIDDING_ADDRESS in .env");
  if (!RELAYER_KEY) throw new Error("Set PRIVATE_KEY in .env (used to relay the signed result)");
  if (!TEE_PRIVATE_KEY) throw new Error("Set TEE_PRIVATE_KEY in .env");

  const provider = new JsonRpcProvider(RPC_URL);
  const relayer = new Wallet(RELAYER_KEY, provider);
  const contract = new Contract(CONTRACT_ADDRESS, artifact.abi, relayer);

  const network = await provider.getNetwork();
  const chainId = network.chainId;

  log(`Watching ${CONTRACT_ADDRESS} on chain ${chainId}. Relaying via ${relayer.address}.`);

  const tick = async () => {
    try {
      const count = await contract.listingCount();
      for (let id = 1n; id <= count; id++) {
        await settleListing(contract, chainId, id);
      }
    } catch (err) {
      log(`Scan error: ${err.message}`);
    }
  };

  await tick();
  setInterval(tick, POLL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
