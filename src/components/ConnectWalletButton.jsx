'use client';

import { ConnectKitButton } from 'connectkit';
import { useSwitchChain } from 'wagmi';
import { APTCASINO_CHAIN } from '@/lib/baseSepolia';

export default function ConnectWalletButton({ className = '', label = 'Connect Base Wallet' }) {
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, truncatedAddress, chain }) => {
        if (isConnected && chain?.unsupported) {
          return <button type="button" className={`wallet-button ${className}`} disabled={isSwitching} onClick={() => switchChain({ chainId: APTCASINO_CHAIN.id })}>{isSwitching ? 'Switching…' : 'Switch to Base Sepolia'}</button>;
        }
        if (isConnected) {
          return <button type="button" className={`wallet-button ${className}`} title="Manage wallet" onClick={show}>{truncatedAddress}</button>;
        }
        return <button type="button" className={`wallet-button ${className}`} disabled={isConnecting} onClick={show}>{isConnecting ? 'Connecting…' : label}</button>;
      }}
    </ConnectKitButton.Custom>
  );
}
