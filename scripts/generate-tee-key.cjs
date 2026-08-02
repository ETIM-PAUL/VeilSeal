// Generates a demo keypair to stand in for the "TEE machine" signer/decryptor.
// In real FCC this key would live inside attested hardware and never be
// exportable; here it's a plain keypair for hackathon demo purposes only.
const EthCrypto = require("eth-crypto");

const identity = EthCrypto.createIdentity();

console.log("Simulated TEE keypair - for demo use only, not a real enclave key:\n");
console.log("TEE_ADDRESS=" + identity.address);
console.log("TEE_PUBLIC_KEY=" + identity.publicKey);
console.log("TEE_PRIVATE_KEY=" + identity.privateKey);
console.log("\nAdd all three lines to your .env file.");
console.log("TEE_ADDRESS and TEE_PUBLIC_KEY also go in the frontend as VITE_TEE_ADDRESS / VITE_TEE_PUBLIC_KEY.");
