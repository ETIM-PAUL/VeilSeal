require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // OpenZeppelin 5.6's Bytes.sol requires MCOPY (Cancun), which is
      // widely supported by now including Flare's C-chain testnets.
      evmVersion: "cancun",
    },
  },
  networks: {
    coston2: {
      url: process.env.COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc",
      chainId: 114,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};
