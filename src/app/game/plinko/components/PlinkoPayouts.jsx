'use client';

import { useState } from 'react';
import { FaCoins } from 'react-icons/fa';
import { plinkoMultiplier } from '@/lib/inco/payoutMath';

const RISKS = [
  { label: 'Low', index: 0, tone: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' },
  { label: 'Medium', index: 1, tone: 'text-amber-300 border-amber-400/30 bg-amber-500/10' },
  { label: 'High', index: 2, tone: 'text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-500/10' },
];
const ROW_SAMPLES = [8, 12, 16];

function Mult({ value, emphasize }) {
  return (
    <span
      className={`font-display text-base font-bold tabular-nums sm:text-lg ${
        emphasize
          ? 'text-transparent bg-clip-text bg-gradient-to-r from-red-magic to-blue-magic'
          : 'text-white/80'
      }`}
    >
      {value.toFixed(2)}×
    </span>
  );
}

export default function PlinkoPayouts() {
  const [riskIndex, setRiskIndex] = useState(1);
  const risk = RISKS[riskIndex];

  return (
    <section className="h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-black/40">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-red-magic to-blue-magic" />
              <h3 className="font-display text-lg font-semibold text-white sm:text-xl">Payout table</h3>
            </div>
            <p className="max-w-lg text-sm text-white/50">
              Center vs edge multipliers from live AptCasino settlement math (3% fee included).
            </p>
          </div>

          <div className="flex rounded-full border border-white/10 bg-black/25 p-0.5">
            {RISKS.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setRiskIndex(r.index)}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition ${
                  riskIndex === r.index
                    ? 'bg-gradient-to-r from-red-magic to-blue-magic text-white'
                    : 'text-white/45 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className={`mb-4 inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${risk.tone}`}>
          {risk.label} risk
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/35">
                <th className="pb-3 pr-3 font-bold">Rows</th>
                <th className="pb-3 pr-3 font-bold">Center</th>
                <th className="pb-3 font-bold">Edge</th>
              </tr>
            </thead>
            <tbody>
              {ROW_SAMPLES.map((rows) => {
                const center = plinkoMultiplier(risk.index, rows, Math.floor(rows / 2));
                const edge = plinkoMultiplier(risk.index, rows, 0);
                return (
                  <tr key={rows} className="border-b border-white/5 last:border-0">
                    <td className="py-3.5 pr-3">
                      <span className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-sm text-white/80">
                        {rows}
                      </span>
                    </td>
                    <td className="py-3.5 pr-3">
                      <div className="flex flex-col gap-0.5">
                        <Mult value={center} />
                        <span className="text-[10px] uppercase tracking-wider text-white/30">most common</span>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <Mult value={edge} emphasize />
                        <span className="text-[10px] uppercase tracking-wider text-white/30">outer buckets</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-xs leading-relaxed text-white/50">
          <FaCoins className="mt-0.5 shrink-0 text-amber-300" />
          Higher risk raises the edge multiplier and softens the center — same house edge, different variance.
        </div>
      </div>
    </section>
  );
}
