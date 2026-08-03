'use client';

import { useRef, useState } from 'react';
import { FaRobot, FaStop } from 'react-icons/fa';

/**
 * Automated betting loop for the same tile pattern. Only realistic in treasury
 * ("house balance") mode — each round is a real on-chain play+settle, but since
 * the server signs it, the loop needs no wallet popup per round. In direct-wallet
 * mode this would mean 2 signature prompts per round, so auto-bet is disabled there.
 */
export default function AIAutoBetting({ hook, tiles, mineCount, disabled }) {
  const [open, setOpen] = useState(false);
  const [rounds, setRounds] = useState(10);
  const [stopProfit, setStopProfit] = useState(5);
  const [stopLoss, setStopLoss] = useState(5);
  const [winIncrease, setWinIncrease] = useState(0);
  const [lossIncrease, setLossIncrease] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const stopRef = useRef(false);

  const treasuryOnly = hook.mode !== 'treasury';

  async function start() {
    if (disabled || tiles.length === 0) return;
    stopRef.current = false;
    setRunning(true);
    const baseWager = hook.wager;
    let totalProfit = 0;
    for (let i = 0; i < rounds; i += 1) {
      if (stopRef.current) break;
      const before = Number(hook.wager);
      const wagerRaw = Math.round(before * 1_000_000);
      const response = await hook.playTreasury({ selectedTiles: tiles, mineCount, wagerRaw });
      if (!response) break;
      const payoutRaw = Number(response.outcome?.payout ?? 0);
      const profit = payoutRaw / 1_000_000 - before;
      totalProfit += profit;
      setProgress({ round: i + 1, totalProfit });
      const next = profit > 0
        ? (winIncrease > 0 ? before * (1 + winIncrease / 100) : Number(baseWager))
        : (lossIncrease > 0 ? before * (1 + lossIncrease / 100) : Number(baseWager));
      hook.setWager(String(Math.max(0.1, next)));
      if (stopProfit > 0 && totalProfit >= stopProfit) break;
      if (stopLoss > 0 && totalProfit <= -stopLoss) break;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    setRunning(false);
  }

  function stop() {
    stopRef.current = true;
    setRunning(false);
  }

  return (
    <div className="mt-3 w-full rounded-xl border border-purple-700/30 bg-black/20 p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold text-white/80">
        <span className="flex items-center gap-2"><FaRobot className="text-purple-300" /> Auto-bet</span>
        <span className="text-xs text-white/40">{open ? 'Hide' : 'Configure'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {treasuryOnly && (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200/90">
              Auto-bet needs house-balance mode (no per-round wallet signature). Switch modes above to enable it.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="block"><span className="mb-1 block text-white/50">Rounds</span><input type="number" min="1" max="500" className="game-input w-full" value={rounds} onChange={(e) => setRounds(Number(e.target.value))} disabled={running} /></label>
            <label className="block"><span className="mb-1 block text-white/50">Stop profit (USDC)</span><input type="number" min="0" className="game-input w-full" value={stopProfit} onChange={(e) => setStopProfit(Number(e.target.value))} disabled={running} /></label>
            <label className="block"><span className="mb-1 block text-white/50">Stop loss (USDC)</span><input type="number" min="0" className="game-input w-full" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} disabled={running} /></label>
            <label className="block"><span className="mb-1 block text-white/50">On win, wager +%</span><input type="number" min="0" className="game-input w-full" value={winIncrease} onChange={(e) => setWinIncrease(Number(e.target.value))} disabled={running} /></label>
            <label className="block"><span className="mb-1 block text-white/50">On loss, wager +%</span><input type="number" min="0" className="game-input w-full" value={lossIncrease} onChange={(e) => setLossIncrease(Number(e.target.value))} disabled={running} /></label>
          </div>
          {progress && <p className="text-xs text-white/50">Round {progress.round}/{rounds} · net {progress.totalProfit >= 0 ? '+' : ''}{progress.totalProfit.toFixed(3)} USDC</p>}
          {!running ? (
            <button type="button" disabled={treasuryOnly || disabled} onClick={start} className="w-full rounded-lg bg-purple-600 py-2 text-sm font-bold text-white disabled:opacity-40">Start auto-bet</button>
          ) : (
            <button type="button" onClick={stop} className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-sm font-bold text-white"><FaStop /> Stop</button>
          )}
        </div>
      )}
    </div>
  );
}
