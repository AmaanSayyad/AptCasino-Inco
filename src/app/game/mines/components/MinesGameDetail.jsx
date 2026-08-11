'use client';

import { minesMultiplier } from '@/lib/inco/payoutMath';
import { FaChartLine } from 'react-icons/fa';

const MINE_TABS = [1, 3, 5, 8, 10];

/** Payout ladder — first-pick multipliers from live AptCasino settlement math. */
export default function MinesGameDetail() {
  const rows = MINE_TABS.map((mines) => ({
    mines,
    mult: minesMultiplier(mines, 1),
  }));
  const maxMult = Math.max(...rows.map((r) => r.mult));

  return (
    <section className="h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-black/40">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-red-magic to-blue-magic" />
          <h3 className="font-display text-lg font-semibold text-white sm:text-xl">Payout ladder</h3>
        </div>
        <p className="text-sm text-white/50">
          First safe pick payout by mine count. More mines → higher multiplier, lower hit chance.
        </p>
      </div>

      <div className="space-y-2.5 p-5 sm:p-6">
        {rows.map((row) => (
          <div
            key={row.mines}
            className="rounded-xl border border-white/10 bg-black/20 px-3.5 py-3"
          >
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{row.mines} {row.mines === 1 ? 'mine' : 'mines'}</p>
                <p className="text-[11px] text-white/40">after 1 safe pick</p>
              </div>
              <p className="font-display text-xl font-bold tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-red-magic to-blue-magic">
                {row.mult.toFixed(2)}×
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-magic to-blue-magic"
                style={{ width: `${Math.max(8, (row.mult / maxMult) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/40">
        <FaChartLine className="mr-1.5 inline text-fuchsia-300" />
        Multipliers include the 3% contract fee from AptCasino settlement math.
      </div>
    </section>
  );
}

/** Shared shell still used by Game history and any legacy callers. */
export function InfoCard({ icon, title, id, className = '', children }) {
  return (
    <div
      id={id}
      className={`scroll-mt-24 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-black/40 ${className}`}
    >
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
          {icon}
          {title}
        </h3>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}
