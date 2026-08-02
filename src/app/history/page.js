'use client';

import { useEffect, useState } from 'react';
import { usePlayWallet } from '@/lib/hooks/usePlayWallet';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { basescanUrl } from '@/lib/baseSepolia';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function fmtAmount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function GameHistoryRow({ game }) {
  const won = Number(game.payout_raw || 0) > Number(game.bet_raw || 0);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold capitalize text-white">{game.game}</p>
        <p className="text-xs text-white/45">{fmtDate(game.created_at)}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-white">{fmtAmount(game.bet_raw)} {game.currency || 'USDC'}</p>
        <p className={`text-xs font-semibold ${won ? 'text-emerald-300' : 'text-white/45'}`}>
          {won ? '+' : ''}{fmtAmount(game.payout_raw)} {game.currency || 'USDC'} payout
        </p>
      </div>
      {game.proof_reference ? (
        <a
          href={basescanUrl('tx', game.proof_reference)}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-white/5"
        >
          Verify on BaseScan
        </a>
      ) : null}
    </div>
  );
}

export default function HistoryPage() {
  const { address, connected } = usePlayWallet();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!connected || !address) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/game-history?wallet=${encodeURIComponent(address)}&limit=100`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setGames(j.history || []); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [connected, address]);

  return (
    <div className="site-page-top min-h-screen bg-gradient-to-b from-sharp-black to-[#150012] text-white">
      <div className="border-b border-white/10 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-display font-bold">Game History</h1>
          <p className="mt-1 text-white/55">View your confidential game history with on-chain verification.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!connected ? (
          <div className="text-center py-12">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-white mb-4">Connect your wallet</h2>
              <p className="text-white/55 mb-6">Connect on Base Sepolia to view your gaming history and settlement details.</p>
              <ConnectWalletButton />
            </div>
          </div>
        ) : loading ? (
          <p className="text-center py-12 text-white/55">Loading game history…</p>
        ) : error ? (
          <p className="text-center py-12 text-rose-300">{error}</p>
        ) : games.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-white/70">No games played yet</p>
            <p className="mt-1 text-sm text-white/45">Start playing to see your history here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {games.map((game) => <GameHistoryRow key={game.id} game={game} />)}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-white mb-3">Provably fair gaming</h3>
            <p className="text-white/55 text-sm">Every game result is verifiable on-chain with Inco Lightning attested randomness.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-3">Track performance</h3>
            <p className="text-white/55 text-sm">Monitor your wins, losses, and betting patterns over time.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-3">On-chain verification</h3>
            <p className="text-white/55 text-sm">Inspect the settlement transaction for each round on BaseScan.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
