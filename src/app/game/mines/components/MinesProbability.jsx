'use client';

import { useMemo } from 'react';
import { HiOutlineChartBar } from 'react-icons/hi';
import { InfoCard } from './MinesGameDetail';

const TOTAL_TILES = 25;
const MINE_TABS = [1, 3, 5, 8, 10];

function winProbabilityRows() {
  return MINE_TABS.map((mines) => {
    const safeTiles = TOTAL_TILES - mines;
    return { mines, safeTiles, probability: Math.round((safeTiles / TOTAL_TILES) * 100) };
  });
}

export default function MinesProbability() {
  const probabilityRows = useMemo(winProbabilityRows, []);
  return (
    <InfoCard icon={<HiOutlineChartBar className="text-green-400" />} title="Win probability" id="probability">
      <div className="space-y-2">
        {probabilityRows.map((row) => (
          <div key={row.mines} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 text-white/60">{row.mines} mines</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600" style={{ width: `${row.probability}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right font-medium text-white/80">{row.probability}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-white/40">Chance the first pick is safe, per mine count.</p>
    </InfoCard>
  );
}
