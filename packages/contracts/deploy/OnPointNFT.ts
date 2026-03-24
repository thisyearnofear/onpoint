import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying OnPointNFT with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "CELO");

  // Deployment parameters
  const NAME = "OnPoint";
  const SYMBOL = "ONPT";
  const BASE_URI = "https://api.onpoint.studio/metadata/";
  const MINT_PRICE = ethers.parseEther("0"); // Free mint
  const MAX_SUPPLY = 0; // Unlimited
  const ROYALTY_RECEIVER = deployer.address;
  const ROYALTY_BPS = 1500; // 15%

  const OnPointNFT = await ethers.getContractFactory("OnPointNFT");
  const nft = await OnPointNFT.deploy(
    NAME,
    SYMBOL,
    BASE_URI,
    MINT_PRICE,
    MAX_SUPPLY,
    ROYALTY_RECEIVER,
    ROYALTY_BPS,
  );

  await nft.waitForDeployment();
  const address = await nft.getAddress();

  console.log("\nOnPointNFT deployed to:", address);
  console.log("Owner:", deployer.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);

  // Verify on explorer (if API key is set)
  if (process.env.CELOSCAN_API_KEY) {
    console.log("\nWaiting for block confirmations...");
    // Wait for a few blocks before verifying
    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: [
          NAME,
          SYMBOL,
          BASE_URI,
          MINT_PRICE,
          MAX_SUPPLY,
          ROYALTY_RECEIVER,
          ROYALTY_BPS,
        ],
      });
      console.log("Contract verified on Celoscan");
    } catch (err: any) {
      console.log("Verification failed (can retry manually):", err.message);
    }
  }

  console.log("\nUpdate config/chains.ts with:");
  console.log(`  celo: "${address}" as Address,`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
