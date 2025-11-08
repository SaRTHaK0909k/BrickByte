import { ethers } from "hardhat";
import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Deploying RealEstateToken contract on Conflux network...");

  const RealEstateToken = await ethers.getContractFactory("RealEstateToken");
  const realEstateToken = await RealEstateToken.deploy();

  await realEstateToken.waitForDeployment();
  const address = await realEstateToken.getAddress();

  console.log("RealEstateToken deployed to:", address);

  // Wait for a few block confirmations before verifying
  console.log("Waiting for block confirmations...");
  await realEstateToken.deploymentTransaction()?.wait(5);

  // Verify the contract only if an API key is provided and it looks like a key
  const rawApi = process.env.CONFLUXSCAN_API_KEY || process.env.ETHERSCAN_API_KEY;
  if (!rawApi) {
    console.log("No explorer API key found in env; skipping automatic verification.");
    return;
  }

  // Defensive: if user accidentally put a URL into the API key env (common mistake), skip verify
  if (/^https?:\/\//i.test(rawApi)) {
    console.log("Explorer API value looks like a URL rather than an API key; skipping verification.");
    return;
  }

  console.log("Verifying contract...");
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [],
    });
    console.log("Contract verified successfully");
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 