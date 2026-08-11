'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaTrophy, FaMedal, FaCrown } from 'react-icons/fa';

function shortWallet(address) {
  if (!address) return '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** API already returns USDC units (not raw 1e6). */
function fmtUsdc(n) {
  return Number(n || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function RankIcon({ rank }) {
  if (rank === 1) return <FaCrown className="text-amber-300" />;
  if (rank === 2) return <FaMedal className="text-white/70" />;
  if (rank === 3) return <FaMedal className="text-amber-700" />;
  return <span className="font-display text-xs font-bold text-white/35">#{rank}</span>;
}

export default function RouletteLeaderboard({ stage }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/leaderboard?game=roulette&limit=10')
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setLeaderboard(j.leaderboard || []); })
      .catch(() => { if (!cancelled) setLeaderboard([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [stage]);

  return (
    <section className="h-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 sm:p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FaTrophy className="text-amber-300" />
          <h3 className="font-display text-lg font-semibold text-white sm:text-xl">Leaderboard</h3>
        </div>
        <Link
          href="/leaderboard?game=roulette"
          className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-300 hover:text-fuchsia-200"
        >
          Full board →
        </Link>
      </div>
      <p className="mb-4 text-sm text-white/50">Top roulette wallets by volume on Base Sepolia.</p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/45">
          No roulette rankings yet.
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.slice(0, 8).map((row) => (
            <div
              key={row.wallet}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                row.rank <= 3
                  ? 'border-fuchsia-400/20 bg-gradient-to-r from-red-magic/10 to-blue-magic/10'
                  : 'border-white/10 bg-black/20'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/30 ring-1 ring-white/10">
                  <RankIcon rank={row.rank} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm text-white/80">{shortWallet(row.wallet)}</p>
                  <p className="text-[11px] text-white/35">
                    {Number(row.bets || 0)} bets
                    {row.won != null ? ` · ${fmtUsdc(row.won)} won` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-white">{fmtUsdc(row.wagered)} USDC</p>
                <p className="text-[10px] uppercase tracking-wider text-white/35">wagered</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
