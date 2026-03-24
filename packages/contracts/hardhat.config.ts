import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local from the web app (where AGENT_PRIVATE_KEY lives)
dotenv.config({ path: path.resolve(__dirname, "../../apps/web/.env.local") });

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || "0x" + "00".repeat(32);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./src",
    artifacts: "./artifacts",
    cache: "./cache",
  },
  networks: {
    hardhat: {},
    celo: {
      url: "https://forno.celo.org",
      chainId: 42220,
      accounts: [PRIVATE_KEY],
    },
    celoSepolia: {
      url:
        process.env.NEXT_PUBLIC_CELO_ALFAJORES_RPC_URL ||
        "https://celo-sepolia.g.alchemy.com/v2/W73tCsyRsW9JfV4orIbr7",
      chainId: 11142220,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      celo: process.env.CELOSCAN_API_KEY || "placeholder",
      celoSepolia: process.env.CELOSCAN_API_KEY || "placeholder",
    },
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io",
        },
      },
      {
        network: "celoSepolia",
        chainId: 11142220,
        urls: {
          apiURL: "https://api-sepolia.celoscan.io/api",
          browserURL: "https://sepolia.celoscan.io",
        },
      },
    ],
  },
};

export default config;
