'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignMessage, useWriteContract, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { usdcAbi, usdcAddress, USDC_DECIMALS } from '@/lib/contracts/usdc';
import { friendlyWalletError } from '@/lib/walletError';

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '';
const SESSION_KEY_PREFIX = 'aptcasino_treasury_session_';
const BALANCE_EVENT = 'aptcasino:treasury-balance';

/** Navbar + game pages each call useTreasuryAccount() — keep balances in sync. */
function publishBalance(address, balanceRaw) {
  if (typeof window === 'undefined' || !address) return;
  window.dispatchEvent(
    new CustomEvent(BALANCE_EVENT, {
      detail: { address: address.toLowerCase(), balanceRaw: Number(balanceRaw) || 0 },
    }),
  );
}

function sessionKey(address) {
  return `${SESSION_KEY_PREFIX}${address?.toLowerCase()}`;
}

function readStoredSession(address) {
  if (typeof window === 'undefined' || !address) return null;
  try {
    const raw = window.localStorage.getItem(sessionKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || new Date(parsed.expiresAt).getTime() < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * The custodial "house balance" account: deposit USDC once, play many rounds with
 * zero further wallet signatures (one signature issues a 24h session token instead).
 */
export function useTreasuryAccount() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [session, setSession] = useState(null);
  const [balanceRaw, setBalanceRaw] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const applyBalanceRaw = useCallback((nextRaw, { broadcast = true } = {}) => {
    const value = Number(nextRaw) || 0;
    setBalanceRaw(value);
    if (broadcast && address) publishBalance(address, value);
  }, [address]);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    const res = await fetch(`/api/treasury/balance?wallet=${address}`).then((r) => r.json()).catch(() => null);
    if (res && typeof res.balanceRaw === 'number') applyBalanceRaw(res.balanceRaw);
  }, [address, applyBalanceRaw]);

  useEffect(() => {
    setSession(address ? readStoredSession(address) : null);
    if (address) refreshBalance();
  }, [address, refreshBalance]);

  // Keep every mounted BalanceChip in sync when any instance updates the ledger.
  useEffect(() => {
    if (!address) return undefined;
    const onBalance = (event) => {
      const detail = event.detail;
      if (!detail || detail.address !== address.toLowerCase()) return;
      if (typeof detail.balanceRaw === 'number') setBalanceRaw(detail.balanceRaw);
    };
    window.addEventListener(BALANCE_EVENT, onBalance);
    return () => window.removeEventListener(BALANCE_EVENT, onBalance);
  }, [address]);

  const ensureSession = useCallback(async () => {
    if (!address) return null;
    const existing = readStoredSession(address);
    if (existing) { setSession(existing); return existing; }

    const nonce = Date.now().toString();
    const message = `AptCasino treasury-session-${nonce} for ${address.toLowerCase()}`;
    const signature = await signMessageAsync({ message });
    const res = await fetch('/api/treasury/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, nonce, signature }),
    }).then((r) => r.json());
    if (!res.token) throw new Error(res.error || 'Could not start a treasury session');
    window.localStorage.setItem(sessionKey(address), JSON.stringify(res));
    setSession(res);
    return res;
  }, [address, signMessageAsync]);

  const deposit = useCallback(async (amountUsdc) => {
    if (!address || !TREASURY_ADDRESS) return;
    setBusy(true); setError('');
    try {
      const amountRaw = parseUnits(amountUsdc, USDC_DECIMALS);
      const txHash = await writeContractAsync({ address: usdcAddress, abi: usdcAbi, functionName: 'transfer', args: [TREASURY_ADDRESS, amountRaw] });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      const res = await fetch('/api/treasury/deposit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, txHash }),
      }).then((r) => r.json());
      if (typeof res.balanceRaw === 'number') applyBalanceRaw(res.balanceRaw);
      return { ...res, txHash };
    } catch (depositError) {
      setError(friendlyWalletError(depositError, 'Deposit failed.'));
      return null;
    } finally {
      setBusy(false);
    }
  }, [address, writeContractAsync, publicClient, applyBalanceRaw]);

  const withdraw = useCallback(async (amountUsdc) => {
    setBusy(true); setError('');
    try {
      const active = await ensureSession();
      const amountRaw = parseUnits(amountUsdc, USDC_DECIMALS);
      const res = await fetch('/api/treasury/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${active.token}` },
        body: JSON.stringify({ amountRaw: Number(amountRaw) }),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error || 'Withdraw failed');
      applyBalanceRaw(res.balanceRaw);
      return res;
    } catch (withdrawError) {
      setError(friendlyWalletError(withdrawError, 'Withdraw failed.'));
      return null;
    } finally {
      setBusy(false);
    }
  }, [ensureSession, applyBalanceRaw]);

  return {
    isConnected, treasuryAddress: TREASURY_ADDRESS, configured: Boolean(TREASURY_ADDRESS),
    session, ensureSession, balanceRaw, balance: formatUnits(BigInt(balanceRaw || 0), USDC_DECIMALS),
    deposit, withdraw, busy, error, refreshBalance, applyBalanceRaw,
  };
}
