'use client';

import { useRef, useState } from 'react';
import { FaRobot, FaStop } from 'react-icons/fa';

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Automated betting loop for the incremental Mines session: each round is
 * start -> reveal x N -> cashOut (or a bust ends the round early). Only realistic in
 * treasury ("house balance") mode — every step is a real on-chain transaction, but
 * since the server signs it, the loop needs no wallet popup per step. In direct-wallet
 * mode this would mean a signature per reveal/cashOut, so auto-bet is disabled there.
 *
 * Reads/writes go through `sessionRef` (kept fresh every render by the parent) rather
 * than a plain destructured session object — this loop spans many awaits, and a
 * closure over the hook's state at loop-start time would go stale after the first
 * setState. `nextTick()` after each hook call gives React a chance to flush the
 * resulting re-render before we read the ref again.
 */
export default function AIAutoBetting({ sessionRef, mode, mineCount, disabled }) {
  const [open, setOpen] = useState(false);
  const [rounds, setRounds] = useState(10);
  const [picksPerRound, setPicksPerRound] = useState(3);
  const [stopProfit, setStopProfit] = useState(5);
  const [stopLoss, setStopLoss] = useState(5);
  const [winIncrease, setWinIncrease] = useState(0);
  const [lossIncrease, setLossIncrease] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const stopRef = useRef(false);

  const treasuryOnly = mode !== 'treasury';

  function randomTile(exclude) {
    let tile;
    do { tile = Math.floor(Math.random() * 25); } while (exclude.has(tile));
    return tile;
  }

  async function playOneRound() {
    sessionRef.current.reset();
    await nextTick();
    await sessionRef.current.start();
    await nextTick();
    if (sessionRef.current.stage === 'error') return null;

    const picked = new Set();
    for (let i = 0; i < picksPerRound; i += 1) {
      if (stopRef.current) break;
      const tile = randomTile(picked);
      picked.add(tile);
      const wagerBefore = Number(sessionRef.current.wager);
      await sessionRef.current.reveal(tile);
      await nextTick();
      if (sessionRef.current.busted) return { profit: -wagerBefore };
      if (sessionRef.current.stage === 'error') return null;
    }
    const wagerAtCashout = Number(sessionRef.current.wager);
    await sessionRef.current.cashOut();
    await nextTick();
    if (sessionRef.current.payout == null) return null;
    return { profit: sessionRef.current.payout / 1_000_000 - wagerAtCashout };
  }

  async function start() {
    if (disabled || treasuryOnly) return;
    stopRef.current = false;
    setRunning(true);
    const baseWager = sessionRef.current.wager;
    let totalProfit = 0;
    for (let i = 0; i < rounds; i += 1) {
      if (stopRef.current) break;
      const before = Number(sessionRef.current.wager);
      const outcome = await playOneRound();
      if (!outcome) break;
      totalProfit += outcome.profit;
      setProgress({ round: i + 1, totalProfit });
      const next = outcome.profit > 0
        ? (winIncrease > 0 ? before * (1 + winIncrease / 100) : Number(baseWager))
        : (lossIncrease > 0 ? before * (1 + lossIncrease / 100) : Number(baseWager));
      sessionRef.current.setWager(String(Math.max(0.1, next)));
      await nextTick();
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
              Auto-bet needs house-balance mode (no per-step wallet signature). Switch modes above to enable it.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="block"><span className="mb-1 block text-white/50">Rounds</span><input type="number" min="1" max="500" className="game-input w-full" value={rounds} onChange={(e) => setRounds(Number(e.target.value))} disabled={running} /></label>
            <label className="block"><span className="mb-1 block text-white/50">Tiles per round</span><input type="number" min="1" max={25 - mineCount} className="game-input w-full" value={picksPerRound} onChange={(e) => setPicksPerRound(Number(e.target.value))} disabled={running} /></label>
            <label className="block"><span className="mb-1 block text-white/50">Stop profit (USDC)</span><input type="number" min="0" className="game-input w-full" value={stopProfit} onChange={(e) => setStopProfit(Number(e.target.value))} disabled={running} /></label>
            <label className="block"><span className="mb-1 block text-white/50">Stop loss (USDC)</span><input type="number" min="0" className="game-input w-full" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} disabled={running} /></label>
            <label className="block"><span className="mb-1 block text-white/50">On win, wager +%</span><input type="number" min="0" className="game-input w-full" value={winIncrease} onChange={(e) => setWinIncrease(Number(e.target.value))} disabled={running} /></label>
            <label className="block"><span className="mb-1 block text-white/50">On loss, wager +%</span><input type="number" min="0" className="game-input w-full" value={lossIncrease} onChange={(e) => setLossIncrease(Number(e.target.value))} disabled={running} /></label>
          </div>
          <p className="text-[11px] text-white/35">Each round auto-picks {picksPerRound} random tiles, then cashes out — stops immediately if any pick is a mine.</p>
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
