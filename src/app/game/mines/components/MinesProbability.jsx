'use client';

import { useMemo, useState } from 'react';
import { HiOutlineChartBar } from 'react-icons/hi';

const TOTAL_TILES = 25;
const MINE_TABS = [1, 3, 5, 8, 10];

/** Probability of surviving the first N picks without hitting a mine. */
function survivalProbability(mines, picks) {
  let p = 1;
  for (let i = 0; i < picks; i += 1) {
    const remainingSafe = TOTAL_TILES - mines - i;
    const remainingTiles = TOTAL_TILES - i;
    if (remainingSafe <= 0 || remainingTiles <= 0) return 0;
    p *= remainingSafe / remainingTiles;
  }
  return p;
}

export default function MinesProbability() {
  const [picks, setPicks] = useState(1);

  const rows = useMemo(
    () =>
      MINE_TABS.map((mines) => {
        const probability = survivalProbability(mines, picks);
        return {
          mines,
          safeTiles: TOTAL_TILES - mines,
          probability,
          pct: probability * 100,
        };
      }),
    [picks],
  );

  return (
    <section id="probability" className="scroll-mt-24 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-black/40">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-red-magic to-blue-magic" />
              <h3 className="font-display text-lg font-semibold text-white sm:text-xl">Win probability</h3>
            </div>
            <p className="text-sm text-white/50">
              Chance of surviving <span className="font-semibold text-white/75">{picks} safe {picks === 1 ? 'pick' : 'picks'}</span> without hitting a mine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">Picks</span>
            <div className="flex rounded-full border border-white/10 bg-black/25 p-0.5">
              {[1, 2, 3, 5, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPicks(n)}
                  className={`min-w-[2.25rem] rounded-full px-2.5 py-1.5 text-[11px] font-bold transition ${
                    picks === n
                      ? 'bg-gradient-to-r from-red-magic to-blue-magic text-white'
                      : 'text-white/45 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 p-5 sm:p-6">
        {rows.map((row) => (
          <div key={row.mines} className="rounded-xl border border-white/10 bg-black/20 px-3.5 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {row.mines} {row.mines === 1 ? 'mine' : 'mines'}
                </p>
                <p className="text-[11px] text-white/40">{row.safeTiles} safe tiles on a 5×5 board</p>
              </div>
              <p
                className={`font-display text-xl font-bold tabular-nums ${
                  row.pct >= 70 ? 'text-emerald-300' : row.pct >= 40 ? 'text-amber-300' : 'text-fuchsia-300'
                }`}
              >
                {row.pct.toFixed(1)}%
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${
                  row.pct >= 70
                    ? 'from-emerald-400 to-teal-400'
                    : row.pct >= 40
                      ? 'from-amber-400 to-orange-400'
                      : 'from-fuchsia-400 to-red-magic'
                }`}
                style={{ width: `${Math.max(4, Math.min(100, row.pct))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/40">
        <HiOutlineChartBar className="mr-1.5 inline text-emerald-300" />
        Survival odds compound — each extra pick multiplies remaining safe tiles / remaining tiles.
      </div>
    </section>
  );
}
