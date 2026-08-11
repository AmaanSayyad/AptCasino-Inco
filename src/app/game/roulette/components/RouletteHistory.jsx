'use client';

import { useEffect, useState } from 'react';
import { FaHistory, FaExternalLinkAlt } from 'react-icons/fa';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';
import { basescanUrl } from '@/lib/baseSepolia';

function fmtUsdc(raw) {
  return (Number(raw || 0) / 10 ** USDC_DECIMALS).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

export default function RouletteHistory({ address, stage }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/game-history?wallet=${encodeURIComponent(address)}&game=roulette&limit=20`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setHistory(j.history || []); })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address, stage]);

  return (
    <section className="h-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <FaHistory className="text-fuchsia-300" />
        <h3 className="font-display text-lg font-semibold text-white sm:text-xl">Your history</h3>
      </div>
      <p className="mb-4 text-sm text-white/50">Recent roulette settlements for this wallet.</p>

      {!address ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/45">
          Connect your wallet to see your rounds.
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/45">
          No roulette rounds yet — place a bet to start your history.
        </div>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {history.map((h) => {
            const won = Number(h.payout_raw) > Number(h.bet_raw);
            return (
              <div
                key={h.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white/80">{h.result || 'Settled'}</p>
                  <p className="text-[11px] text-white/35">
                    {h.created_at ? new Date(h.created_at).toLocaleString() : '—'}
                    <span className="mx-1.5">·</span>
                    bet {fmtUsdc(h.bet_raw)} USDC
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`text-sm font-bold tabular-nums ${won ? 'text-emerald-300' : 'text-white/45'}`}>
                    {won ? '+' : ''}{fmtUsdc(h.payout_raw)} USDC
                  </span>
                  {h.proof_reference && (
                    <a
                      href={basescanUrl('tx', h.proof_reference)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-bold text-fuchsia-200 hover:bg-white/10"
                    >
                      Verify <FaExternalLinkAlt className="text-[9px]" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
