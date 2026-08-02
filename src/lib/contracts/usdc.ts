import { parseAbi } from 'viem';
import { MEGAPOT_TESTNET } from '@/lib/baseSepolia';

export const usdcAddress = MEGAPOT_TESTNET.usdc;
export const USDC_DECIMALS = 6;

export const usdcAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);
