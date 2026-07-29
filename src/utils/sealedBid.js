import EthCrypto from "eth-crypto";
import {
  AbiCoder,
  keccak256,
  encodeBytes32String,
  getBytes,
  hexlify,
  randomBytes,
  Wallet,
  verifyMessage,
} from "ethers";

// Must match the Solidity constant: bytes32("VEILPAY_TEE_ACTION_RESULT")
// (a direct string-to-bytes32 cast, mirroring Flare's own
// `bytes32("TEE_ACTION_RESULT")` convention — not a keccak256 hash).
export const TEE_ACTION_RESULT_PREFIX = encodeBytes32String("VEILPAY_TEE_ACTION_RESULT");

// On-chain amounts are integers; bid amounts in the UI are displayed with
// up to 2 decimal places, so we scale by 100 before hashing/encoding.
export const AMOUNT_SCALE = 100n;

const abiCoder = AbiCoder.defaultAbiCoder();

export function toChainAmount(displayAmount) {
  return BigInt(Math.round(Number(displayAmount) * 100));
}

export function fromChainAmount(chainAmount) {
  return Number(chainAmount) / 100;
}

export function randomNonce() {
  return hexlify(randomBytes(32));
}

/// Mirrors: keccak256(abi.encode(uint256 amount, bytes32 nonce, address bidder))
export function computeTermsCommitment({ amount, nonce, bidder }) {
  const encoded = abiCoder.encode(["uint256", "bytes32", "address"], [amount, nonce, bidder]);
  return keccak256(encoded);
}

/// ECIES-encrypts the true bid terms so only the holder of the TEE's
/// private key can read them — the on-chain contract only ever sees the
/// commitment hash and this opaque ciphertext.
export async function encryptBidTerms({ amount, nonce, bidder }, teePublicKey) {
  const plaintext = JSON.stringify({ amount: amount.toString(), nonce, bidder });
  const encrypted = await EthCrypto.encryptWithPublicKey(teePublicKey, plaintext);
  return "0x" + EthCrypto.cipher.stringify(encrypted);
}

/// The TEE-side counterpart — in production this only ever runs inside the
/// attested enclave. Included here so the "simulate TEE settlement" demo
/// flow can actually decrypt real ciphertexts produced by real bidders.
export async function decryptBidTerms(encryptedHex, teePrivateKey) {
  const hex = encryptedHex.startsWith("0x") ? encryptedHex.slice(2) : encryptedHex;
  const cipher = EthCrypto.cipher.parse(hex);
  const plaintext = await EthCrypto.decryptWithPrivateKey(teePrivateKey, cipher);
  const parsed = JSON.parse(plaintext);
  return { amount: BigInt(parsed.amount), nonce: parsed.nonce, bidder: parsed.bidder };
}

/// Mirrors: keccak256(abi.encode(address contractAddress, uint256 listingId, address winner, uint256 winningAmount))
export function computeResultHash({ contractAddress, listingId, winner, winningAmount }) {
  const encoded = abiCoder.encode(
    ["address", "uint256", "address", "uint256"],
    [contractAddress, listingId, winner, winningAmount]
  );
  return keccak256(encoded);
}

/// Mirrors the contract's domain-separated hash:
/// keccak256(abi.encode(TEE_ACTION_RESULT_PREFIX, chainId, address(this), listingId, resultHash))
export function computeSignedHash({ contractAddress, chainId, listingId, resultHash }) {
  const encoded = abiCoder.encode(
    ["bytes32", "uint256", "address", "uint256", "bytes32"],
    [TEE_ACTION_RESULT_PREFIX, chainId, contractAddress, listingId, resultHash]
  );
  return keccak256(encoded);
}

/// Signs a domain-separated result hash with the TEE's private key, using
/// the same personal-sign (EIP-191) scheme the contract verifies via
/// ECDSA.recover / MessageHashUtils.toEthSignedMessageHash.
export async function signResult(signedHash, teePrivateKey) {
  const wallet = new Wallet(teePrivateKey);
  return wallet.signMessage(getBytes(signedHash));
}

/// Client-side signature check (no contract call needed) — recovers the
/// signer address from a signed hash + signature, for display/verification
/// in the UI before or independent of an on-chain read.
export function recoverSigner(signedHash, signature) {
  return verifyMessage(getBytes(signedHash), signature);
}
