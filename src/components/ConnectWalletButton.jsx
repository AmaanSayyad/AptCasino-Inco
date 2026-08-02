'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { APTCASINO_CHAIN } from '@/lib/baseSepolia';

export default function ConnectWalletButton({ className = '', label = 'Connect Base Wallet' }) {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  if (isConnected && chainId !== APTCASINO_CHAIN.id) {
    return <button type="button" className={`wallet-button ${className}`} disabled={isSwitching} onClick={() => switchChain({ chainId: APTCASINO_CHAIN.id })}>{isSwitching ? 'Switching…' : 'Switch to Base Sepolia'}</button>;
  }

  if (isConnected) {
    return <button type="button" className={`wallet-button ${className}`} title="Disconnect wallet" onClick={() => disconnect()}>{address?.slice(0, 6)}…{address?.slice(-4)}</button>;
  }

  return <button type="button" className={`wallet-button ${className}`} disabled={isPending || !connectors[0]} onClick={() => connectors[0] && connect({ connector: connectors[0] })}>{isPending ? 'Connecting…' : label}</button>;
}
