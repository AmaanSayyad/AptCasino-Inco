'use client';

import { useMemo } from 'react';
import { FaChartLine } from 'react-icons/fa';
import { riskLabelToIndex } from '@/lib/plinko/plinkoBoard';
import { plinkoMultiplier } from '@/lib/inco/payoutMath';

function binomial(n, k) {
  let res = 1;
  for (let i = 0; i < k; i += 1) res = (res * (n - i)) / (i + 1);
  return res;
}

/** Real binomial landing probability per bucket for `rows` coin-flip pegs. */
function bucketProbabilities(rows) {
  const total = 2 ** rows;
  return Array.from({ length: rows + 1 }, (_, k) => binomial(rows, k) / total);
}

function barTone(mult) {
  if (mult >= 2) return 'from-fuchsia-400 to-red-magic';
  if (mult >= 1) return 'from-emerald-400 to-teal-400';
  return 'from-white/40 to-white/20';
}

export default function PlinkoWinProbabilities({ risk = 'Medium', rows = 16 }) {
  const riskIndex = riskLabelToIndex(risk);
  const rows_ = useMemo(() => {
    const probs = bucketProbabilities(rows);
    return probs.map((p, bucket) => ({
      bucket,
      probability: p,
      multiplier: plinkoMultiplier(riskIndex, rows, bucket),
    }));
  }, [riskIndex, rows]);

  const maxPct = Math.max(...rows_.map((r) => r.probability * 100), 1);

  return (
    <section className="flex h-full max-h-[22rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-black/40 lg:max-h-full">
      <div className="shrink-0 border-b border-white/10 px-5 py-4 sm:px-5">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-red-magic to-blue-magic" />
          <h3 className="font-display text-lg font-semibold text-white sm:text-xl">Win probabilities</h3>
        </div>
        <p className="text-sm text-white/50">
          Live for <span className="font-semibold text-white/75">{rows} rows · {risk}</span> — binomial peg paths, contract multipliers.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain p-3 sm:p-4">
        <div className="mb-0.5 grid grid-cols-[3rem_1fr_2.75rem_3.25rem] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-white/35">
          <span>Bucket</span>
          <span>Hit chance</span>
          <span className="text-right">%</span>
          <span className="text-right">Payout</span>
        </div>
        {rows_.map((row) => {
          const pct = row.probability * 100;
          return (
            <div
              key={row.bucket}
              className="grid grid-cols-[3rem_1fr_2.75rem_3.25rem] items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5"
            >
              <span className="font-mono text-xs text-white/70">#{row.bucket}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${barTone(row.multiplier)}`}
                  style={{ width: `${Math.max(4, (pct / maxPct) * 100)}%` }}
                />
              </div>
              <span className="text-right font-mono text-[11px] tabular-nums text-white/70">{pct.toFixed(2)}</span>
              <span
                className={`text-right font-display text-sm font-bold tabular-nums ${
                  row.multiplier >= 1 ? 'text-emerald-300' : 'text-white/45'
                }`}
              >
                {row.multiplier.toFixed(2)}×
              </span>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-white/10 px-4 py-2.5 text-[11px] text-white/40">
        <FaChartLine className="mr-1.5 inline text-fuchsia-300" />
        Center buckets hit most often; edges pay more and land least.
      </div>
    </section>
  );
}
