'use client';

import { useEffect, useState } from 'react';
import { basescanUrl } from '@/lib/baseSepolia';

const GAME_ICON = { roulette: '🎯', wheel: '🎡', plinko: '🔺', mines: '💎' };

function shortWallet(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—';
}

function fmtUsdc(raw) {
  const n = Number(raw || 0) / 1e6;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function RecentProofFeed() {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/game-history?limit=6')
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setRounds(j.history || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!loading && rounds.length === 0) return null;

  return (
    <div className="mt-14">
      <h2 className="font-display text-2xl font-bold">Recently verified, not just claimed</h2>
      <p className="mt-2 text-sm text-white/50">
        Every row below is a real settlement on Base Sepolia — click through and check it yourself.
      </p>
      <div className="mt-5 space-y-2">
        {loading
          ? Array.from({ length: 3 }, (_, i) => <div key={i} className="roadmap-glass h-16 animate-pulse rounded-xl" />)
          : rounds.map((round) => {
            const won = Number(round.payout_raw || 0) > Number(round.bet_raw || 0);
            return (
              <div key={round.id} className="roadmap-glass flex items-center justify-between gap-3 rounded-xl px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-xl">{GAME_ICON[round.game] || '🎲'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold capitalize">{round.game}</p>
                    <p className="truncate text-xs text-white/40">{shortWallet(round.wallet)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${won ? 'text-emerald-300' : 'text-white/40'}`}>
                    {won ? '+' : ''}{fmtUsdc(round.payout_raw)} USDC
                  </span>
                  {round.proof_reference && (
                    <a
                      href={basescanUrl('tx', round.proof_reference)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-white/5"
                    >
                      Verify ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
