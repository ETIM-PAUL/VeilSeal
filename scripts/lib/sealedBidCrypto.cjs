// CommonJS counterpart to src/utils/sealedBid.js - duplicated (not shared)
// because the browser bundle (ESM) and this Node-only TEE simulator (CJS)
// must never share a module graph: the whole point is that TEE_PRIVATE_KEY-
// dependent code (decrypt, sign) can only run here, never in the frontend.
const EthCrypto = require("eth-crypto");
const { AbiCoder, keccak256, encodeBytes32String, getBytes, Wallet } = require("ethers");

// Must match the Solidity constant: bytes32("VEILPAY_TEE_ACTION_RESULT")
// (direct string-to-bytes32 cast, mirroring Flare's own convention).
const TEE_ACTION_RESULT_PREFIX = encodeBytes32String("VEILPAY_TEE_ACTION_RESULT");
const abiCoder = AbiCoder.defaultAbiCoder();

function computeTermsCommitment({ amount, nonce, bidder }) {
  const encoded = abiCoder.encode(["uint256", "bytes32", "address"], [amount, nonce, bidder]);
  return keccak256(encoded);
}

async function decryptBidTerms(encryptedHex, teePrivateKey) {
  const hex = encryptedHex.startsWith("0x") ? encryptedHex.slice(2) : encryptedHex;
  const cipher = EthCrypto.cipher.parse(hex);
  const plaintext = await EthCrypto.decryptWithPrivateKey(teePrivateKey, cipher);
  const parsed = JSON.parse(plaintext);
  return { amount: BigInt(parsed.amount), nonce: parsed.nonce, bidder: parsed.bidder };
}

function computeResultHash({ contractAddress, listingId, winner, winningAmount }) {
  const encoded = abiCoder.encode(
    ["address", "uint256", "address", "uint256"],
    [contractAddress, listingId, winner, winningAmount]
  );
  return keccak256(encoded);
}

function computeSignedHash({ contractAddress, chainId, listingId, resultHash }) {
  const encoded = abiCoder.encode(
    ["bytes32", "uint256", "address", "uint256", "bytes32"],
    [TEE_ACTION_RESULT_PREFIX, chainId, contractAddress, listingId, resultHash]
  );
  return keccak256(encoded);
}

async function signResult(signedHash, teePrivateKey) {
  const wallet = new Wallet(teePrivateKey);
  return wallet.signMessage(getBytes(signedHash));
}

module.exports = {
  TEE_ACTION_RESULT_PREFIX,
  computeTermsCommitment,
  decryptBidTerms,
  computeResultHash,
  computeSignedHash,
  signResult,
};
