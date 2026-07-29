const hre = require("hardhat");

async function main() {
  const teeAddress = process.env.TEE_ADDRESS;
  if (!teeAddress) {
    throw new Error("Set TEE_ADDRESS in .env — the simulated TEE signer's public address.");
  }

  const VeilBidding = await hre.ethers.getContractFactory("VeilBidding");
  const contract = await VeilBidding.deploy(teeAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("VeilBidding deployed to:", address);
  console.log("TEE signer address:", teeAddress);
  console.log("Network:", hre.network.name);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
