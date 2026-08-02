'use client';

import { useAccount } from 'wagmi';

/**
 * Compatibility shim for restored legacy components that expect the old
 * multi-chain `usePlayWallet()` hook. This app is Base Sepolia-only now.
 */
export function usePlayWallet() {
  const { address, isConnected } = useAccount();
  return { connected: isConnected, address, chain: 'base-sepolia' };
}
