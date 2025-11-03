import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

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
    // 🧪 Ethereum Sepolia Testnet
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },

    // ⚙️ Local Hardhat Network
    hardhat: {
      chainId: 1337,
    },

    // 🧩 Conflux eSpace Testnet
    confluxTestnet: {
      url: "https://evmtestnet.confluxrpc.com",
      chainId: 71,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },

  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
  },

  etherscan: {
    // Only Sepolia verification uses real API key
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      confluxTestnet: "placeholder", // required by Hardhat syntax
    },
    customChains: [
      {
        network: "confluxTestnet",
        chainId: 71,
        urls: {
          apiURL: "https://evmtestnet.confluxscan.net/api",
          browserURL: "https://evmtestnet.confluxscan.net",
        },
      },
    ],
  },
};

export default config;