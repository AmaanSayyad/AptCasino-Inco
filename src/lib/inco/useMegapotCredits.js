'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { rewardVaultAbi, rewardVaultAddress } from '@/lib/contracts/aptCasino';
import { isContractConfigured } from '@/lib/baseSepolia';
import { friendlyWalletError } from '@/lib/walletError';

/**
 * Megapot progress, shared by every page that shows it. On-chain credits (from
 * direct-wallet play, where the player IS msg.sender) and off-chain credits (from
 * house-balance play, where the treasury is msg.sender — see src/lib/treasury/megapot.js)
 * are summed into ONE total so switching modes never makes progress look like it reset.
 * A ticket still only comes out of whichever single pool actually has 1000+ — claim()
 * picks that pool automatically; canClaim is false if the total clears 1000 but it's
 * split across both with neither alone enough.
 *
 * `treasury` is optional — pass the page's `useTreasuryAccount()` instance to enable
 * claiming from the off-chain pool; without it, this still reads/sums correctly, just
 * can't claim that half.
 */
export function useMegapotCredits(treasury) {
  const { address } = useAccount();
  const vaultConfigured = isContractConfigured(rewardVaultAddress);

  const onChainRead = useReadContract({
    address: rewardVaultAddress,
    abi: rewardVaultAbi,
    functionName: 'credits',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && vaultConfigured), refetchInterval: 15_000 },
  });
  const onChainCredits = Number(onChainRead.data ?? 0n);
  const { writeContract: claimOnChain, data: claimHash, isPending: claimOnChainPending } = useWriteContract();
  const claimReceipt = useWaitForTransactionReceipt({ hash: claimHash });

  const [treasuryCredits, setTreasuryCredits] = useState(0);
  const [treasuryClaimPending, setTreasuryClaimPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!address) return undefined;
    let cancelled = false;
    const poll = () => fetch(`/api/treasury/megapot/credits?wallet=${address}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setTreasuryCredits(Number(data.credits ?? 0)); })
      .catch(() => {});
    poll();
    const id = setInterval(poll, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [address]);

  async function claimTreasuryTicket() {
    if (!address || !treasury) return null;
    setTreasuryClaimPending(true);
    try {
      const active = await treasury.ensureSession();
      const response = await fetch('/api/treasury/megapot/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${active.token}` },
      }).then((r) => r.json());
      if (!response.ok) throw new Error(response.error || 'Claim failed.');
      setTreasuryCredits((c) => Math.max(0, c - 1000));
      return response;
    } catch (claimError) {
      setError(friendlyWalletError(claimError, 'Claim failed.'));
      return null;
    } finally {
      setTreasuryClaimPending(false);
    }
  }

  const canClaimTreasury = Boolean(treasury) && treasuryCredits >= 1000;
  const canClaimOnChain = onChainCredits >= 1000;
  const canClaim = canClaimTreasury || canClaimOnChain;

  function claim() {
    if (canClaimTreasury) return claimTreasuryTicket();
    if (canClaimOnChain) return claimOnChain({ address: rewardVaultAddress, abi: rewardVaultAbi, functionName: 'claimTicket' });
    return null;
  }

  return {
    credits: onChainCredits + treasuryCredits,
    vaultConfigured, canClaim, claim, claimError: error,
    claimPending: treasuryClaimPending || claimOnChainPending,
    claimReceiptLoading: claimReceipt.isLoading,
    claimReceiptSuccess: claimReceipt.isSuccess,
    rewardVaultAbi, rewardVaultAddress,
  };
}
