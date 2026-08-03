'use client';

import { useState } from 'react';
import { FaTable } from 'react-icons/fa';
import { minesMultiplier } from '@/lib/inco/payoutMath';
import { InfoCard } from './MinesGameDetail';

const MINE_TABS = [1, 3, 5, 8, 10];
const MAX_ROWS = 10;

/** Multiplier-per-pick table recomputed from the live contract's math, per mine count. */
export default function MinesBettingTable() {
  const [activeTab, setActiveTab] = useState(0);
  const mines = MINE_TABS[activeTab];
  const rows = Array.from({ length: Math.min(MAX_ROWS, 25 - mines) }, (_, i) => ({
    picks: i + 1,
    multiplier: minesMultiplier(mines, i + 1),
  }));

  return (
    <InfoCard icon={<FaTable className="text-blue-400" />} title="Multiplier table">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {MINE_TABS.map((m, i) => (
          <button
            key={m}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              i === activeTab ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {m} mines
          </button>
        ))}
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {rows.map((row) => (
          <div key={row.picks} className="flex items-center justify-between rounded-lg border border-purple-800/15 bg-black/20 px-3 py-1.5 text-sm">
            <span className="text-white/60">{row.picks} {row.picks === 1 ? 'pick' : 'picks'}</span>
            <span className="font-bold text-yellow-400">{row.multiplier.toFixed(2)}x</span>
          </div>
        ))}
      </div>
    </InfoCard>
  );
}
