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

/** Platform wallet used as primary Megapot referrer on ticket buys (override via env). */
export const PLATFORM_REFERRER_ADDRESS = (process.env.NEXT_PUBLIC_PLATFORM_REFERRER ||
  process.env.NEXT_PUBLIC_TREASURY_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

export const CASINO_ADDRESS = (process.env.NEXT_PUBLIC_APTCASINO_ADDRESS ||
  '0xe2c0864966d8bB7B2c334A7bd27945970Dc68792') as `0x${string}`;

export const REWARD_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_MEGAPOT_REWARD_VAULT_ADDRESS ||
  '0xC4be5B0c5C3d9F163B138e187BfCa82cA2aEAC80') as `0x${string}`;

export function basescanUrl(kind: 'address' | 'tx', value: string) {
  return `https://sepolia.basescan.org/${kind}/${value}`;
}

export function isContractConfigured(address: `0x${string}`) {
  return address !== '0x0000000000000000000000000000000000000000';
}
