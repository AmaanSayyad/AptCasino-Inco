import { baseSepolia } from 'viem/chains';

export const APTCASINO_CHAIN = baseSepolia;
export const APTCASINO_CHAIN_ID = 84532;

export const BASE_SEPOLIA_RPC_URLS = [
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  'https://base-sepolia.drpc.org',
  'https://sepolia.base.org',
].filter((url): url is string => Boolean(url));

export const MEGAPOT_TESTNET = {
  usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  jackpot: '0x465dA3c859f193A3807386387bEE941B2A4c3279',
  ticketNft: '0x45084829ac63f9dC6a3D4981A46FA896f9180ECd',
  randomTicketBuyer: '0x53c04e7e5044B28Ea8A4F9c4b26E3Ac1aeb63746',
} as const;

export const CASINO_ADDRESS = (process.env.NEXT_PUBLIC_APTCASINO_ADDRESS ||
  '0x9A9974B0C0A2A3855528e9b0eE68931c705A0E0F') as `0x${string}`;

export const REWARD_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_MEGAPOT_REWARD_VAULT_ADDRESS ||
  '0x9BCf1914F96f4b438Fb22aAE7ba46343FBC8ADB8') as `0x${string}`;

export function basescanUrl(kind: 'address' | 'tx', value: string) {
  return `https://sepolia.basescan.org/${kind}/${value}`;
}

export function isContractConfigured(address: `0x${string}`) {
  return address !== '0x0000000000000000000000000000000000000000';
}
