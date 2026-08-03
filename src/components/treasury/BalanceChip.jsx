'use client';

import { useState } from 'react';
import HouseBalanceModal from '@/components/treasury/HouseBalanceModal';

/** Compact balance display + deposit/withdraw trigger, dropped into each game page's header. */
export default function BalanceChip({ treasury }) {
  const [open, setOpen] = useState(false);
  if (!treasury.isConnected) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20"
      >
        <span className="font-mono tabular-nums">{treasury.balance}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70">USDC balance</span>
      </button>
      <HouseBalanceModal open={open} onClose={() => setOpen(false)} treasury={treasury} />
    </>
  );
}
