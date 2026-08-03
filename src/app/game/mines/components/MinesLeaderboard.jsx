'use client';

import { useEffect, useState } from 'react';
import { FaTrophy } from 'react-icons/fa';
import { InfoCard } from './MinesGameDetail';

export default function MinesLeaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetch('/api/leaderboard?game=mines&limit=10').then((r) => r.json()).then((j) => setLeaderboard(j.leaderboard || [])).catch(() => {});
  }, []);

  return (
    <InfoCard icon={<FaTrophy className="text-yellow-400" />} title="Leaderboard" id="leaderboard" className="mt-6">
      {leaderboard.length === 0 ? <p className="text-sm text-white/50">No rounds recorded yet.</p> : (
        <div className="space-y-1.5">
          {leaderboard.slice(0, 10).map((row) => (
            <div key={row.wallet} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <span className="text-white/50">#{row.rank}</span>
              <span className="truncate font-mono text-xs text-white/70">{row.wallet}</span>
              <span className="font-semibold text-emerald-300">{(row.won / 1e6).toFixed(2)} USDC won</span>
            </div>
          ))}
        </div>
      )}
    </InfoCard>
  );
}
