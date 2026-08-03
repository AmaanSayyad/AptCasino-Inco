'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { HiOutlineVolumeUp, HiOutlineVolumeOff, HiOutlineInformationCircle } from 'react-icons/hi';
import { FaCoins, FaRegGem } from 'react-icons/fa';
import { GiCrystalGrowth } from 'react-icons/gi';
import { minesStageCopy } from '@/lib/inco/useMinesSession';
import { minesMultiplier } from '@/lib/inco/payoutMath';
import MinesHowToModal from './MinesHowToModal';
import WinConfetti from './WinConfetti';

const GRID_SIZE = 5;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
const MAX_MINES = 10; // UI cap for a reasonable multiplier ladder — AptCasino.sol allows up to 24.
const MAX_PICKS = 10;

const SOUNDS = { click: '/sounds/click.mp3', gem: '/sounds/gem.mp3', explosion: '/sounds/explosion.mp3', win: '/sounds/win.mp3', bet: '/sounds/bet.mp3' };

// Chance the NEXT single pick is a mine, given `picks` already safely revealed out of `mines` mines among 25 tiles.
function nextPickMineChancePercent(mines, picks) {
  const remainingTiles = TOTAL_TILES - picks;
  if (remainingTiles <= 0) return 0;
  return Math.round((mines / remainingTiles) * 100);
}

/** The right-column board — ported from the original's game.jsx (mute/info row, mines
 * stepper, stat boxes, dotted/gem grid, inline cash-out, multiplier ladder). Bet-amount
 * and round-start controls live in the sibling MinesForm (left column) instead, matching
 * the original's split. Session/gameHook are lifted to the page so both columns share
 * one instance instead of each holding a separate copy. */
export default function MinesBoard({ session, audioRefs, isMuted, setIsMuted, pendingTile, setPendingTile, bustedTile, setBustedTile }) {
  const [showInfo, setShowInfo] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const lastBustedRef = useRef(false);
  const lastPayoutRef = useRef(null);

  const minePositions = useMemo(
    () => (session.minePositions ? new Set(session.minePositions.map(Number)) : null),
    [session.minePositions],
  );
  const revealedSet = useMemo(() => new Set(session.revealedTiles), [session.revealedTiles]);
  const roundOver = session.busted || session.payout != null;
  const multiplier = session.revealedTiles.length > 0 ? minesMultiplier(session.mineCount, session.revealedTiles.length) : 1;
  const chance = nextPickMineChancePercent(session.mineCount, session.revealedTiles.length);

  const multiplierLadder = useMemo(
    () => Array.from({ length: Math.min(MAX_PICKS, TOTAL_TILES - session.mineCount) }, (_, i) => ({
      tiles: i + 1,
      multiplier: minesMultiplier(session.mineCount, i + 1),
    })),
    [session.mineCount],
  );

  function playSound(name) {
    if (isMuted || !audioRefs[name]?.current) return;
    try {
      const audio = audioRefs[name].current;
      audio.currentTime = 0;
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (session.busted && !lastBustedRef.current) {
      playSound('explosion');
      toast.error('Game over! You hit a mine.');
    }
    lastBustedRef.current = session.busted;
  }, [session.busted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session.payout != null && lastPayoutRef.current !== session.payout) {
      playSound('win');
      toast.success(`Cashed out! Payout: ${(session.payout / 1_000_000).toFixed(4)} USDC`);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
    lastPayoutRef.current = session.payout;
  }, [session.payout]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session.stage === 'error' && session.error) toast.error(session.error);
  }, [session.stage, session.error]);

  async function handleReveal(index) {
    if (!session.active || pendingTile != null || revealedSet.has(index)) return;
    playSound('click');
    setPendingTile(index);
    try {
      await session.reveal(index);
      if (!session.busted) playSound('gem');
      else setBustedTile(index);
    } finally {
      setPendingTile(null);
    }
  }

  function adjustMines(delta) {
    if (session.active) return;
    session.setMineCount((current) => Math.max(1, Math.min(MAX_MINES, current + delta)));
  }

  const canReveal = session.active && !roundOver;

  function getCellContent(index) {
    const isRevealedSafe = revealedSet.has(index);
    const isMine = minePositions?.has(index);
    const isPending = pendingTile === index;
    const clickable = canReveal && pendingTile == null && !revealedSet.has(index);

    if (isPending) {
      return { className: 'border-white/20 bg-white/10 animate-pulse', content: null, clickable: false };
    }
    if (roundOver && isMine) {
      return {
        className: index === bustedTile ? 'border-red-500/80 bg-gradient-to-br from-red-800 to-red-950' : 'border-red-500/40 bg-gradient-to-br from-red-900/60 to-red-950/80',
        content: <Image src="/images/bomb.png" alt="Mine" width={64} height={64} className="h-10 w-10 object-contain md:h-12 md:w-12" />,
        clickable: false,
      };
    }
    if (isRevealedSafe) {
      return {
        className: 'border-cyan-500/40 bg-gradient-to-br from-cyan-900/40 to-blue-900/50',
        content: <Image src="/images/diamond.png" alt="Gem" width={64} height={64} className="h-10 w-10 object-contain md:h-12 md:w-12" />,
        clickable: false,
      };
    }
    // Unrevealed: a pulsing dot while it's actually pickable, a dim gem glyph otherwise —
    // matches the original's idle-vs-playable tile treatment.
    return {
      className: clickable ? 'border-purple-500/35 bg-gradient-to-br from-[#1a1028] to-[#12081c] hover:border-purple-400/60' : 'border-white/8 bg-gradient-to-br from-[#141018] to-[#0c080f]',
      content: clickable
        ? <div className="h-2 w-2 rounded-full bg-purple-400/50 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
        : <FaRegGem className="text-lg text-white/10 md:text-xl" aria-hidden />,
      clickable,
    };
  }

  return (
    <div className="relative flex w-full flex-col items-center">
      {Object.entries(SOUNDS).map(([key, src]) => <audio key={key} ref={audioRefs[key]} src={src} preload="auto" />)}
      {showConfetti && <WinConfetti />}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} closeOnClick pauseOnHover theme="dark" />
      <MinesHowToModal open={showInfo} onClose={() => setShowInfo(false)} totalTiles={TOTAL_TILES} />

      <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-3">
          <button className="rounded-full bg-purple-900/20 p-2 transition-colors hover:bg-purple-900/40" onClick={() => setIsMuted((m) => !m)} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <HiOutlineVolumeOff className="text-xl text-white/70" /> : <HiOutlineVolumeUp className="text-xl text-white/70" />}
          </button>
          <button className="rounded-full bg-blue-900/20 p-2 transition-colors hover:bg-blue-900/40" onClick={() => setShowInfo(true)} title="Game Info">
            <HiOutlineInformationCircle className="text-xl text-white/70" />
          </button>
        </div>
        <div className="flex items-center">
          <div className="mr-2 text-sm text-white/70">Mines:</div>
          <div className="flex items-center overflow-hidden rounded bg-gray-900/50">
            <button className="bg-red-900/30 px-2 py-1 text-white hover:bg-red-900/50 disabled:opacity-50" onClick={() => adjustMines(-1)} disabled={session.active || session.mineCount <= 1}>-</button>
            <div className="px-3 py-1 font-medium text-white">{session.mineCount}</div>
            <button className="bg-green-900/30 px-2 py-1 text-white hover:bg-green-900/50 disabled:opacity-50" onClick={() => adjustMines(1)} disabled={session.active || session.mineCount >= MAX_MINES}>+</button>
          </div>
        </div>
      </div>

      <div className="mb-3 grid w-full grid-cols-3 gap-2">
        <Stat label="Chance of Mine" value={`${chance}%`} valueClassName={chance > 50 ? 'text-red-400' : 'text-white'} />
        <Stat label="Multiplier" value={`${multiplier.toFixed(2)}x`} valueClassName="text-yellow-400" />
        <Stat label="Safe picks" value={`${session.revealedTiles.length} / ${Math.min(MAX_PICKS, TOTAL_TILES - session.mineCount)}`} valueClassName="text-white" />
      </div>

      <div className="relative mx-auto mb-3 w-full max-w-md">
        {['approving', 'betting', 'revealing', 'settling'].includes(session.stage) && (
          <div className="mb-2 rounded-lg border border-purple-500/25 bg-purple-950/40 px-3 py-1.5 text-center text-xs text-purple-200">
            {minesStageCopy[session.stage]}…
          </div>
        )}
        <div className="grid w-full gap-1.5" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
          {Array.from({ length: TOTAL_TILES }, (_, index) => {
            const cell = getCellContent(index);
            return (
              <motion.button
                key={index}
                type="button"
                onClick={() => cell.clickable && handleReveal(index)}
                disabled={!cell.clickable}
                whileHover={{ scale: cell.clickable ? 1.04 : 1 }}
                whileTap={{ scale: cell.clickable ? 0.96 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className={`flex aspect-square items-center justify-center rounded-xl border shadow-md transition-colors duration-150 ${cell.className} ${cell.clickable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {cell.content}
              </motion.button>
            );
          })}
        </div>
      </div>

      {canReveal && (
        <div className="w-full space-y-2">
          <button
            type="button"
            onClick={session.cashOut}
            disabled={session.revealedTiles.length === 0 || pendingTile != null}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 py-3 font-bold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaCoins className="text-yellow-300" />
            <span>{session.revealedTiles.length === 0 ? 'Reveal a tile to cash out' : `Cash out ${multiplier.toFixed(2)}x`}</span>
          </button>
          <p className="flex items-center justify-center gap-1 text-center text-xs text-white/40">Pick a tile, or cash out anytime once you&apos;ve revealed at least one safe tile.</p>
        </div>
      )}

      {roundOver && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`w-full rounded-lg py-2.5 text-center font-bold ${session.payout != null ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {session.payout != null ? `Cashed out! +${(session.payout / 1_000_000).toFixed(4)} USDC` : 'Game Over! You hit a mine!'}
        </motion.div>
      )}

      <div className="mt-4 w-full">
        <h3 className="mb-2 flex items-center justify-between text-sm font-medium text-white/90">
          <span className="flex items-center"><GiCrystalGrowth className="mr-2 text-blue-400" />Multiplier ladder</span>
          <span className="text-[10px] font-normal text-white/40">{session.mineCount} mines</span>
        </h3>
        <div className="rounded-xl border border-gray-700/50 bg-black/40 p-3 shadow-lg">
          <div className="scrollbar-thin overflow-x-auto pb-1">
            <div className="flex min-w-max gap-3">
              {multiplierLadder.map((item) => (
                <div key={item.tiles} className={`min-w-[95px] rounded-lg p-2.5 text-center ${item.tiles === session.revealedTiles.length ? 'border-2 border-purple-500/80 bg-gradient-to-br from-purple-700 to-purple-600 font-bold text-white shadow-lg shadow-purple-700/50' : 'border border-gray-700/50 bg-gradient-to-br from-gray-800/90 to-gray-900/90 text-white/90'}`}>
                  <div className="mb-1 text-xs font-medium">{item.tiles} Tiles</div>
                  <div className="text-xl font-semibold">{item.multiplier.toFixed(2)}x</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, valueClassName }) {
  return (
    <div className="rounded bg-gray-900/50 p-2 text-center">
      <div className="mb-1 text-xs text-white/50">{label}</div>
      <div className={`text-lg font-bold ${valueClassName}`}>{value}</div>
    </div>
  );
}
