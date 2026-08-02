import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';
import type { HardhatUserConfig } from 'hardhat/config';

const privateKey = process.env.PRIVATE_KEY_BASE_SEPOLIA;

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.30',
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: 'cancun' },
  },
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      chainId: 84532,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

export default config;
