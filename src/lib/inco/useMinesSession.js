'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { startMinesSession, revealMinesTile, cashOutMines } from '@/lib/inco/gameEngine';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';

export const minesStageCopy = {
  idle: 'Ready', approving: 'Approving USDC', betting: 'Locking wager on Base',
  revealing: 'Waiting for Inco covalidators', settling: 'Committing mine layout',
  playing: 'Pick a tile', busted: 'Hit a mine', done: 'Cashed out', error: 'Action needed',
};

/**
 * Mines' incremental session: start (locks wager + commits an Inco-attested mine
 * layout, hidden in contract storage) -> reveal tiles one at a time -> cash out
 * whenever, or bust on a mine. Pass the `treasury` object already returned by
 * useConfidentialGame('mines') so both hooks share one balance/session instance
 * instead of each maintaining its own.
 */
export function useMinesSession({ treasury }) {
  const { address } = useAccount();
  const [mode, setMode] = useState('treasury');
  const [wager, setWager] = useState('1');
  const [mineCount, setMineCount] = useState(5);
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState('');
  const [gameId, setGameId] = useState(null);
  const [revealedTiles, setRevealedTiles] = useState([]);
  const [busted, setBusted] = useState(false);
  const [minePositions, setMinePositions] = useState(null);
  const [payout, setPayout] = useState(null);

  const active = gameId != null && !busted && payout == null;

  function reset() {
    setStage('idle'); setError(''); setGameId(null); setRevealedTiles([]);
    setBusted(false); setMinePositions(null); setPayout(null);
  }

  async function start() {
    if (!address) return;
    reset();
    try {
      if (mode === 'treasury') {
        const active_ = await treasury.ensureSession();
        setStage('betting');
        const res = await fetch('/api/treasury/mines/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${active_.token}` },
          body: JSON.stringify({ mineCount, wagerRaw: Number(parseUnits(wager, USDC_DECIMALS)) }),
        }).then((r) => r.json());
        if (!res.ok) throw new Error(res.error || 'Could not start the round.');
        setGameId(res.gameId);
        treasury.refreshBalance();
      } else {
        const wagerRaw = parseUnits(wager, USDC_DECIMALS);
        const session = await startMinesSession({ account: address, mineCount, wager: wagerRaw, onStage: setStage });
        setGameId(session.gameId.toString());
      }
      setStage('playing');
    } catch (startError) {
      setStage('error');
      setError(startError instanceof Error ? startError.message : 'Could not start the round.');
    }
  }

  async function reveal(tile) {
    if (!active || revealedTiles.includes(tile)) return;
    try {
      if (mode === 'treasury') {
        const activeSession = await treasury.ensureSession();
        const res = await fetch('/api/treasury/mines/reveal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeSession.token}` },
          body: JSON.stringify({ gameId, tile }),
        }).then((r) => r.json());
        if (!res.ok) throw new Error(res.error || 'Reveal failed.');
        if (res.hitMine) { setBusted(true); setMinePositions(res.minePositions); }
        else setRevealedTiles((tiles) => [...tiles, tile]);
      } else {
        const res = await revealMinesTile({ account: address, gameId: BigInt(gameId), tile });
        if (res.hitMine) { setBusted(true); setMinePositions(res.minePositions); }
        else setRevealedTiles((tiles) => [...tiles, tile]);
      }
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : 'Reveal failed.');
    }
  }

  async function cashOut() {
    if (!active || revealedTiles.length === 0) return;
    try {
      if (mode === 'treasury') {
        const activeSession = await treasury.ensureSession();
        const res = await fetch('/api/treasury/mines/cashout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeSession.token}` },
          body: JSON.stringify({ gameId }),
        }).then((r) => r.json());
        if (!res.ok) throw new Error(res.error || 'Cash out failed.');
        setPayout(res.payoutRaw);
        treasury.refreshBalance();
      } else {
        const res = await cashOutMines({ account: address, gameId: BigInt(gameId) });
        setPayout(Number(res.payout));
        setMinePositions(res.minePositions);
      }
    } catch (cashOutError) {
      setError(cashOutError instanceof Error ? cashOutError.message : 'Cash out failed.');
    }
  }

  return {
    mode, setMode, wager, setWager, mineCount, setMineCount, stage, error,
    gameId, revealedTiles, busted, minePositions, payout, active,
    start, reveal, cashOut, reset,
  };
}
