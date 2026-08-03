'use client';

import { FaChartLine } from 'react-icons/fa';
import { minesMultiplier } from '@/lib/inco/payoutMath';

const MINE_TABS = [1, 3, 5, 8, 10];

/** Payout ladder card — odds recomputed from the live contract's math, not the original's stale numbers. */
export default function MinesGameDetail() {
  return (
    <InfoCard icon={<FaChartLine className="text-blue-400" />} title="Payout ladder">
      <p className="mb-3 text-sm text-white/60">Your potential payout increases with each tile you pick. More mines selected means higher risk and reward.</p>
      <div className="flex flex-wrap gap-2">
        {MINE_TABS.map((mines) => (
          <div key={mines} className="rounded-lg border border-purple-800/20 bg-black/20 px-3 py-2 text-center">
            <div className="text-xs text-white/45">{mines} mines · 1 pick</div>
            <div className="text-sm font-bold text-yellow-400">{minesMultiplier(mines, 1).toFixed(2)}x</div>
          </div>
        ))}
      </div>
    </InfoCard>
  );
}

export function InfoCard({ icon, title, id, className = '', children }) {
  return (
    <div id={id} className={`scroll-mt-24 rounded-xl border-2 border-purple-700/30 bg-gradient-to-br from-[#290023]/80 to-[#150012]/90 p-5 shadow-xl shadow-purple-900/20 backdrop-blur-sm ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-white">{icon}{title}</h3>
      {children}
    </div>
  );
}
