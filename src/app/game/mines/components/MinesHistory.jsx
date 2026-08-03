'use client';

import { useEffect, useState } from 'react';
import { FaHistory } from 'react-icons/fa';
import { InfoCard } from './MinesGameDetail';

export default function MinesHistory({ connected, address }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!connected || !address) { setHistory([]); return; }
    fetch(`/api/game-history?wallet=${encodeURIComponent(address)}&game=mines&limit=20`)
      .then((r) => r.json()).then((j) => setHistory(j.history || [])).catch(() => {});
  }, [connected, address]);

  return (
    <InfoCard icon={<FaHistory className="text-pink-400" />} title="Game history" id="history" className="mt-6">
      {!connected ? (
        <p className="text-sm text-white/50">Connect your wallet to see your history.</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-white/50">No rounds played yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <span className="text-white/60">{new Date(h.created_at).toLocaleString()}</span>
              <span className="font-semibold">{h.bet_raw ? (Number(h.bet_raw) / 1e6).toFixed(2) : '0'} USDC</span>
              <span className={Number(h.payout_raw) > Number(h.bet_raw) ? 'text-emerald-300' : 'text-white/45'}>
                {Number(h.payout_raw) > Number(h.bet_raw) ? '+' : ''}{(Number(h.payout_raw || 0) / 1e6).toFixed(2)} USDC
              </span>
              {h.proof_reference && (
                <a className="text-xs text-emerald-300 hover:underline" href={`https://sepolia.basescan.org/tx/${h.proof_reference}`} target="_blank" rel="noreferrer">Verify ↗</a>
              )}
            </div>
          ))}
        </div>
      )}
    </InfoCard>
  );
}
