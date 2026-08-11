'use client';

import { useMemo, useState } from 'react';
import { FaTable } from 'react-icons/fa';
import { minesMultiplier } from '@/lib/inco/payoutMath';

const MINE_TABS = [1, 3, 5, 8, 10];
const MAX_ROWS = 12;

/** Multiplier-per-pick table from live contract math, per mine count. */
export default function MinesBettingTable() {
  const [mines, setMines] = useState(5);

  const rows = useMemo(() => {
    const maxPicks = Math.min(MAX_ROWS, 25 - mines);
    return Array.from({ length: maxPicks }, (_, i) => ({
      picks: i + 1,
      multiplier: minesMultiplier(mines, i + 1),
    }));
  }, [mines]);

  const maxMult = Math.max(...rows.map((r) => r.multiplier), 1);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-black/40">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-red-magic to-blue-magic" />
          <h3 className="font-display text-lg font-semibold text-white sm:text-xl">Multiplier table</h3>
        </div>
        <p className="mb-4 text-sm text-white/50">
          Cashout grows with each safe pick. Switch mine count to see the curve.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {MINE_TABS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMines(m)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                mines === m
                  ? 'bg-gradient-to-r from-red-magic to-blue-magic text-white'
                  : 'border border-white/10 bg-black/25 text-white/45 hover:text-white'
              }`}
            >
              {m} {m === 1 ? 'mine' : 'mines'}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-4 sm:p-5">
        <div className="mb-1 grid grid-cols-[4rem_1fr_4rem] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-white/35">
          <span>Picks</span>
          <span>Growth</span>
          <span className="text-right">Payout</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.picks}
            className="grid grid-cols-[4rem_1fr_4rem] items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2"
          >
            <span className="font-mono text-xs text-white/70">{row.picks}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-400"
                style={{ width: `${Math.max(6, (row.multiplier / maxMult) * 100)}%` }}
              />
            </div>
            <span className="text-right font-display text-sm font-bold tabular-nums text-amber-300">
              {row.multiplier.toFixed(2)}×
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/40">
        <FaTable className="mr-1.5 inline text-blue-300" />
        Showing up to {MAX_ROWS} picks · live AptCasino.sol math
      </div>
    </section>
  );
}
