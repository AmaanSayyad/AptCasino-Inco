'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaTrophy, FaMedal, FaCrown } from 'react-icons/fa';
import { basescanUrl } from '@/lib/baseSepolia';

function shortWallet(address) {
  if (!address) return '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function fmtUsdc(n) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function RankIcon({ rank }) {
  if (rank === 1) return <FaCrown className="text-amber-300" />;
  if (rank === 2) return <FaMedal className="text-white/70" />;
  if (rank === 3) return <FaMedal className="text-amber-700" />;
  return <span className="font-display text-xs font-bold text-white/35">#{rank}</span>;
}

export default function PlinkoLeaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/leaderboard?game=plinko&limit=10')
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setRows(j.leaderboard || []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const maxWagered = Math.max(...rows.map((r) => Number(r.wagered) || 0), 1);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-black/40">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <FaTrophy className="text-amber-300" />
              <h3 className="font-display text-lg font-semibold text-white sm:text-xl">Plinko leaderboard</h3>
            </div>
            <p className="text-sm text-white/50">Top wallets by volume on Base Sepolia.</p>
          </div>
          <Link
            href="/leaderboard?game=plinko"
            className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-fuchsia-300 hover:text-fuchsia-200"
          >
            Full board →
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4 sm:p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-white/45">
            No settled rounds yet — be the first.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.slice(0, 8).map((row) => {
              const wagered = Number(row.wagered || 0);
              return (
                <a
                  key={row.wallet}
                  href={basescanUrl('address', row.wallet)}
                  target="_blank"
                  rel="noreferrer"
                  className={`block rounded-xl border px-3 py-2.5 transition hover:border-white/20 ${
                    row.rank <= 3
                      ? 'border-fuchsia-400/20 bg-gradient-to-r from-red-magic/10 to-blue-magic/10'
                      : 'border-white/10 bg-black/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/30 ring-1 ring-white/10">
                        <RankIcon rank={row.rank} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm text-white/85">{shortWallet(row.wallet)}</p>
                        <p className="text-[11px] text-white/35">
                          {Number(row.bets || 0)} bets
                          {row.biggestWin != null ? ` · ${fmtUsdc(row.biggestWin)} best` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-white">{fmtUsdc(wagered)} USDC</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/35">wagered</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-magic to-blue-magic"
                      style={{ width: `${Math.max(6, (wagered / maxWagered) * 100)}%` }}
                    />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
