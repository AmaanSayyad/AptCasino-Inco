'use client';

import { useEffect, useState } from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { basescanUrl } from '@/lib/baseSepolia';
import { PageCard, SectionHeading } from '@/components/layout/PageShell';

const GAME_LABEL = { roulette: 'Roulette', wheel: 'Wheel', plinko: 'Plinko', mines: 'Mines' };

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
    <section className="mt-4">
      <SectionHeading
        title="Recently verified"
        subtitle="Every row is a real settlement on Base Sepolia — open BaseScan and check the attestation yourself."
      />
      <div className="space-y-2">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))
          : rounds.map((round) => {
            const won = Number(round.payout_raw || 0) > Number(round.bet_raw || 0);
            return (
              <PageCard key={round.id} className="!rounded-xl" gradient="from-white/15 to-white/5">
                <div className="flex items-center justify-between gap-3 -m-1 md:-m-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-magic/30 to-blue-magic/30 text-xs font-black uppercase tracking-wide text-white ring-1 ring-white/10">
                      {(GAME_LABEL[round.game] || round.game || '?').slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold capitalize text-white">
                        {GAME_LABEL[round.game] || round.game}
                      </p>
                      <p className="truncate font-mono text-xs text-white/40">{shortWallet(round.wallet)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold tabular-nums ${won ? 'text-emerald-300' : 'text-white/45'}`}>
                      {won ? '+' : ''}{fmtUsdc(round.payout_raw)} USDC
                    </span>
                    {round.proof_reference && (
                      <a
                        href={basescanUrl('tx', round.proof_reference)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-bold text-fuchsia-200 transition hover:bg-white/10"
                      >
                        Verify <FaExternalLinkAlt className="text-[10px]" />
                      </a>
                    )}
                  </div>
                </div>
              </PageCard>
            );
          })}
      </div>
    </section>
  );
}
