'use client';

import { useEffect, useState } from 'react';
import { FaTrophy } from 'react-icons/fa';
import { basescanUrl } from '@/lib/baseSepolia';

export default function PlinkoLeaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/leaderboard?game=plinko&limit=10')
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setRows(j.leaderboard || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative bg-gradient-to-br from-[#1A0015]/95 to-[#0d0008]/90 rounded-xl border border-purple-700/30 p-6 overflow-hidden h-full">
      <div className="absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-blue-500" />
      <div className="flex items-center gap-3 mb-5 pt-1">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/30 to-amber-600/20 border border-yellow-500/40 flex items-center justify-center">
          <FaTrophy className="text-yellow-300" size={18} />
        </div>
        <h3 className="text-lg font-semibold bg-gradient-to-r from-white to-yellow-300 bg-clip-text text-transparent">Plinko Leaderboard</h3>
      </div>
      {loading ? (
        <p className="text-sm text-white/50">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-white/50">No settled rounds yet — be the first.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <a key={row.wallet} href={basescanUrl('address', row.wallet)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 hover:bg-black/30">
              <span className="flex items-center gap-2 text-sm text-white/80">
                <span className="w-5 text-center text-xs font-bold text-yellow-300">#{row.rank}</span>
                {row.wallet.slice(0, 6)}…{row.wallet.slice(-4)}
              </span>
              <span className="text-xs text-white/50">{Number(row.wagered || 0).toFixed(2)} USDC wagered</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
