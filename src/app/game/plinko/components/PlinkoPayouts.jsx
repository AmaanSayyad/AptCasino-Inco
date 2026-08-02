'use client';

import { FaCoins } from 'react-icons/fa';
import { plinkoMultiplier } from '@/lib/inco/payoutMath';

const RISKS = [{ label: 'Low', index: 0 }, { label: 'Medium', index: 1 }, { label: 'High', index: 2 }];
const ROW_SAMPLES = [8, 12, 16];

export default function PlinkoPayouts() {
  return (
    <div className="relative bg-gradient-to-br from-[#1A0015]/95 to-[#0d0008]/90 rounded-xl border border-purple-700/30 p-6 overflow-hidden h-full">
      <div className="absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-blue-500" />
      <div className="flex items-center gap-3 mb-5 pt-1">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-600/20 border border-amber-500/40 flex items-center justify-center">
          <FaCoins className="text-amber-300" size={18} />
        </div>
        <h3 className="text-lg font-semibold bg-gradient-to-r from-white to-amber-300 bg-clip-text text-transparent">Payout Table</h3>
      </div>
      <p className="mb-4 text-xs text-white/50">Center-bucket vs. edge-bucket multiplier, straight from AptCasino.sol&apos;s live payout math.</p>
      <div className="space-y-4">
        {RISKS.map((risk) => (
          <div key={risk.label}>
            <p className="mb-2 text-sm font-semibold text-white">{risk.label} risk</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {ROW_SAMPLES.map((rows) => {
                const center = plinkoMultiplier(risk.index, rows, Math.floor(rows / 2));
                const edge = plinkoMultiplier(risk.index, rows, 0);
                return (
                  <div key={rows} className="rounded-lg bg-black/20 p-2 text-center">
                    <p className="text-white/50">{rows} rows</p>
                    <p className="text-white">{center.toFixed(2)}x center</p>
                    <p className="text-emerald-300">{edge.toFixed(2)}x edge</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
