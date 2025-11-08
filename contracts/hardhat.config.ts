import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const CONF_RPC_URL = process.env.CONF_RPC_URL || "";

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

  networks: {
    // ⚙️ Local Hardhat Network
    hardhat: {
      chainId: 1337,
    },
    // 🧩 Conflux eSpace (use CONF_RPC_URL and PRIVATE_KEY in .env)
    conflux: {
      url: CONF_RPC_URL || "",
      chainId: Number(process.env.CONFLUX_CHAIN_ID) || 71,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },

  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
  },

  // Explorer verification config (optional) for Conflux-compatible explorers.
  // If you want Hardhat to auto-verify contracts on Conflux explorer, set the
  // following env vars in contracts/.env:
  // CONFLUXSCAN_API_KEY, CONFLUXSCAN_API_URL, CONFLUXSCAN_BROWSER_URL
  etherscan: {
    apiKey: {
      conflux: process.env.CONFLUXSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "conflux",
        chainId: Number(process.env.CONFLUX_CHAIN_ID) || 71,
        urls: {
          apiURL: process.env.CONFLUXSCAN_API_URL || "https://evmtestnet.confluxscan.net/api",
          browserURL: process.env.CONFLUXSCAN_BROWSER_URL || "https://evmtestnet.confluxscan.net",
        },
      },
    ],
  },
};

export default config;