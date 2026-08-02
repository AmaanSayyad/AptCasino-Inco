'use client';

import { FaChartLine } from 'react-icons/fa';
import { riskLabelToIndex } from '@/lib/plinko/plinkoBoard';
import { plinkoMultiplier } from '@/lib/inco/payoutMath';

function binomial(n, k) {
  let res = 1;
  for (let i = 0; i < k; i += 1) res = (res * (n - i)) / (i + 1);
  return res;
}

/** Real binomial landing probability per bucket for `rows` coin-flip pegs (matches the contract's bit-count logic). */
function bucketProbabilities(rows) {
  const total = 2 ** rows;
  return Array.from({ length: rows + 1 }, (_, k) => binomial(rows, k) / total);
}

export default function PlinkoWinProbabilities({ risk = 'Medium', rows = 16 }) {
  const riskIndex = riskLabelToIndex(risk);
  const probs = bucketProbabilities(rows);
  const rows_ = probs.map((p, bucket) => ({
    bucket,
    probability: p,
    multiplier: plinkoMultiplier(riskIndex, rows, bucket),
  }));

  return (
    <div className="relative bg-gradient-to-br from-[#1A0015]/95 to-[#0d0008]/90 rounded-xl border border-purple-700/30 p-6 overflow-hidden h-full">
      <div className="absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-blue-500" />
      <div className="flex items-center gap-3 mb-5 pt-1">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-600/20 border border-purple-500/40 flex items-center justify-center">
          <FaChartLine className="text-blue-300" size={18} />
        </div>
        <div>
          <h3 className="text-lg font-semibold bg-gradient-to-r from-white to-blue-300 bg-clip-text text-transparent">Win Probabilities</h3>
          <p className="text-xs text-white/50">{rows} rows · {risk} risk</p>
        </div>
      </div>
      <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1 text-sm">
        {rows_.map((row) => (
          <div key={row.bucket} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
            <span className="text-white/60">Bucket {row.bucket}</span>
            <span className="font-mono text-white/80">{(row.probability * 100).toFixed(2)}%</span>
            <span className={`font-semibold ${row.multiplier >= 1 ? 'text-emerald-300' : 'text-white/50'}`}>{row.multiplier.toFixed(2)}x</span>
          </div>
        ))}
      </div>
    </div>
  );
}
