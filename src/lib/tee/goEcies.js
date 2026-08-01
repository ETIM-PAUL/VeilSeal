// Re-implements go-ethereum's crypto/ecies package (ECIES_AES128_SHA256
// params) in the browser, since that's what the real TEE node's /decrypt
// endpoint expects — NOT the eth-crypto npm package's ECIES variant (AES-256
// -CBC, different KDF, different wire framing). The two are incompatible:
// a bid sealed with eth-crypto is permanently undecryptable by the real TEE.
// Verified byte-for-byte against go-ethereum's ecies.Decrypt in a standalone
// round-trip test before wiring this in.
//
// Wire format (matches ecies.Encrypt's output exactly):
//   R (65 bytes, uncompressed secp256k1 point: 0x04 || X || Y)
//   || em = IV (16 bytes) || AES-128-CTR ciphertext
//   || d  = HMAC-SHA256(Km, em)  (32 bytes)
import { SigningKey, sha256, getBytes, hexlify, randomBytes } from "ethers";

const KEY_LEN = 16; // AES-128
const IV_LEN = 16; // AES block size

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// NIST SP 800-56 Concatenation KDF — matches go-ethereum's concatKDF.
function concatKDF(z, kdLen) {
  let output = new Uint8Array(0);
  let counter = 1;
  while (output.length < kdLen) {
    const counterBytes = new Uint8Array(4);
    new DataView(counterBytes.buffer).setUint32(0, counter, false);
    const digest = getBytes(sha256(concatBytes(counterBytes, z)));
    output = concatBytes(output, digest);
    counter++;
  }
  return output.slice(0, kdLen);
}

/// ECIES-encrypts plaintextBytes under the TEE's public key (128 hex chars,
/// x || y, no 0x prefix, no 04 byte — see formatTeePublicKey) using the exact
/// scheme go-ethereum's crypto/ecies.Encrypt(..., ECIES_AES128_SHA256, ...)
/// produces, so the real TEE's /decrypt endpoint can read it.
export async function eciesEncryptForTee(teePublicKeyHex, plaintextBytes) {
  const ephemeral = new SigningKey(hexlify(randomBytes(32)));
  const R = getBytes(ephemeral.publicKey); // 0x04 || X || Y, 65 bytes

  const recipientPub = "0x04" + teePublicKeyHex;
  const shared = getBytes(ephemeral.computeSharedSecret(recipientPub)); // 0x04 || X || Y
  const z = shared.slice(1, 33); // ECDH shared secret = X coordinate only

  const K = concatKDF(z, 2 * KEY_LEN);
  const Ke = K.slice(0, KEY_LEN);
  const Km = getBytes(sha256(K.slice(KEY_LEN, 2 * KEY_LEN)));

  const iv = randomBytes(IV_LEN);
  const aesKey = await crypto.subtle.importKey("raw", Ke, { name: "AES-CTR" }, false, ["encrypt"]);
  const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-CTR", counter: iv, length: 128 }, aesKey, plaintextBytes);
  const em = concatBytes(iv, new Uint8Array(ciphertextBuf));

  const macKey = await crypto.subtle.importKey("raw", Km, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const macBuf = await crypto.subtle.sign("HMAC", macKey, em);
  const d = new Uint8Array(macBuf);

  return concatBytes(R, em, d);
}
