'use client';

import { useEffect, useState } from 'react';
import { FaHistory, FaExternalLinkAlt } from 'react-icons/fa';
import { basescanUrl } from '@/lib/baseSepolia';
import { usePlayWallet } from '@/lib/hooks/usePlayWallet';

function statusFor(row) {
  const isWin = Number(row.payout_raw) >= Number(row.bet_raw);
  return isWin
    ? { color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', label: 'WIN', multColor: 'text-emerald-300' }
    : { color: 'text-rose-300 bg-rose-500/10 border-rose-500/30', label: 'LOSS', multColor: 'text-rose-300' };
}

function fmt(raw) {
  return (Number(raw) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function GameHistory() {
  const { address, connected } = usePlayWallet();
  const [rows, setRows] = useState([]);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    if (!connected || !address) { setRows([]); return; }
    let cancelled = false;
    fetch(`/api/game-history?wallet=${encodeURIComponent(address)}&game=plinko&limit=100`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setRows(j.history || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [connected, address]);

  const visibleRows = rows.slice(0, visibleCount);

  return (
    <div className="relative">
      <div className="flex justify-between items-center gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-pink-500/30 to-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <FaHistory className="text-pink-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-white to-pink-300 bg-clip-text text-transparent truncate">Game History</h3>
            <p className="text-xs text-white/50">Your most recent Plinko drops</p>
          </div>
        </div>
        {rows.length > visibleCount && (
          <button onClick={() => setVisibleCount((c) => Math.min(c + 5, rows.length))} className="shrink-0 bg-gradient-to-r from-purple-800/40 to-pink-700/20 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-white hover:from-purple-700/50 hover:to-pink-600/30 transition-all">
            Show more
          </button>
        )}
      </div>

      {!connected && (
        <p className="py-8 text-center text-sm text-white/50">Connect your wallet to see your drop history.</p>
      )}

      {connected && rows.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-800/40 to-pink-700/20 border border-purple-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaHistory className="text-2xl text-pink-300" />
          </div>
          <p className="text-white/80 text-sm font-medium">No drops yet</p>
          <p className="text-gray-500 text-xs mt-1">Drop your first ball to see results here.</p>
        </div>
      )}

      {visibleRows.length > 0 && (
        <div className="hidden md:block overflow-x-auto rounded-lg border border-[#2a1530]/70">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-900/30 via-pink-900/20 to-purple-900/30">
                {['When', 'Bet', 'Payout', 'Status', 'Proof'].map((col) => (
                  <th key={col} className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white/70">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const s = statusFor(row);
                return (
                  <tr key={row.id} className="border-t border-[#2a1530]/50 hover:bg-purple-900/10 transition-colors">
                    <td className="py-3 px-4 text-gray-300 text-sm">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="py-3 px-4 text-white text-sm font-medium">{fmt(row.bet_raw)} USDC</td>
                    <td className={`py-3 px-4 text-sm font-semibold ${s.multColor}`}>{fmt(row.payout_raw)} USDC</td>
                    <td className="py-3 px-4"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${s.color}`}>{s.label}</span></td>
                    <td className="py-3 px-4">
                      {row.proof_reference ? (
                        <a href={basescanUrl('tx', row.proof_reference)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 text-xs font-mono">
                          {row.proof_reference.slice(0, 6)}…{row.proof_reference.slice(-4)} <FaExternalLinkAlt size={9} />
                        </a>
                      ) : <span className="text-gray-500 text-xs italic">pending</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
          <span className="text-gray-400">Showing {Math.min(visibleCount, rows.length)} of {rows.length} entries</span>
          <span className="text-gray-500">On-chain proof verified via Inco Lightning</span>
        </div>
      )}
    </div>
  );
}
