'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const QUICK_AMOUNTS = [1, 5, 10, 25, 50, 100];
const MIN_DEPOSIT = 1;
const MIN_WITHDRAW = 1;

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden />;
}

/**
 * House balance deposit/withdraw modal — same visual language as the original
 * HouseBalanceModal (portal + spring-in dialog, balance hero, deposit/withdraw
 * tabs, quick amounts). Chain-agnostic bits from the original (multi-chain
 * CHAIN_UI theming, fee-tier/deposit-bonus previews, demo mode) are dropped —
 * this app is Base Sepolia + USDC only now, none of those subsystems exist.
 */
export default function HouseBalanceModal({ open, onClose, treasury }) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState('deposit');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const { balance, balanceRaw, deposit, withdraw, busy, error, refreshBalance, configured } = treasury;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (open) refreshBalance(); }, [open, refreshBalance]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKeyDown); };
  }, [open, onClose]);

  if (!mounted) return null;

  const depositParsed = parseFloat(depositAmount);
  const depositDisabled = !configured || busy || !depositAmount || !Number.isFinite(depositParsed) || depositParsed < MIN_DEPOSIT;
  const withdrawParsed = parseFloat(withdrawAmount);
  const currentBalance = Number(balance);
  const withdrawDisabled = !configured || busy || !withdrawAmount || !Number.isFinite(withdrawParsed) ||
    withdrawParsed < MIN_WITHDRAW || withdrawParsed > currentBalance;

  async function handleDeposit() {
    const res = await deposit(depositAmount);
    if (res?.ok) setDepositAmount('');
  }
  async function handleWithdraw() {
    const res = await withdraw(withdrawAmount);
    if (res?.ok) setWithdrawAmount('');
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="house-balance-title">
          <motion.div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative z-[1] w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/10 bg-[#0A0008] shadow-2xl shadow-black/60 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-emerald-500/[0.08] via-transparent to-fuchsia-500/[0.06] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-fuchsia-300/70">Wallet</p>
                <h2 id="house-balance-title" className="font-display text-lg font-bold text-white sm:text-xl">House balance</h2>
                <p className="mt-0.5 text-xs text-white/45">Credits for in-app play · withdraw anytime</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={refreshBalance} className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/5 hover:text-white" title="Refresh balance" aria-label="Refresh balance">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
                <button type="button" onClick={onClose} className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/5 hover:text-white" aria-label="Close">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="px-5 pt-5 sm:px-6">
              <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-[#120010] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Available to play</p>
                <p className="font-mono text-2xl font-bold tabular-nums tracking-tight text-emerald-300 sm:text-3xl">
                  {balance}<span className="ml-1.5 text-base font-semibold text-white/50 sm:text-lg">USDC</span>
                </p>
                {!configured && (
                  <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200/90">
                    House balance is not configured yet — ask an admin to set NEXT_PUBLIC_TREASURY_ADDRESS.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 px-5 sm:px-6">
              <div className="flex rounded-xl border border-white/10 bg-black/40 p-1">
                {[{ id: 'deposit', label: 'Deposit' }, { id: 'withdraw', label: 'Withdraw' }].map(({ id, label }) => (
                  <button key={id} type="button" onClick={() => setTab(id)}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-all ${tab === id ? 'bg-gradient-to-r from-red-magic/90 to-blue-magic/90 text-white shadow-md' : 'text-white/45 hover:text-white/70'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 sm:px-6 sm:pb-6">
              {tab === 'deposit' ? (
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-white/45">Move USDC from your connected wallet into your house balance to place bets without signing every round.</p>
                  <p className="text-[11px] text-white/40 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">Minimum deposit: <span className="font-mono text-white/65">{MIN_DEPOSIT} USDC</span>.</p>
                  <div className="flex gap-2">
                    <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.00" className="game-input flex-1" />
                    <button type="button" disabled={depositDisabled} onClick={handleDeposit} className="shrink-0 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40">
                      {busy ? <Spinner /> : 'Deposit'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_AMOUNTS.map((amount) => (
                      <button key={amount} type="button" onClick={() => setDepositAmount(String(amount))} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-semibold text-white/60 hover:bg-white/10">{amount}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-white/45">Send USDC from your house balance back to your connected wallet.</p>
                  <p className="text-[11px] text-white/40 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">Available: <span className="font-mono text-white/65">{balance} USDC</span>.</p>
                  <div className="flex gap-2">
                    <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0.00" className="game-input flex-1" />
                    <button type="button" disabled={withdrawDisabled} onClick={handleWithdraw} className="shrink-0 rounded-xl bg-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                      {busy ? <Spinner /> : 'Withdraw'}
                    </button>
                  </div>
                  <button type="button" onClick={() => setWithdrawAmount(balance)} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-semibold text-white/60 hover:bg-white/10">Max</button>
                </div>
              )}
              {error && <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-2 text-[11px] text-red-200">{error}</p>}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
