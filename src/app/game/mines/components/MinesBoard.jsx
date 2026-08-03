'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { HiOutlineVolumeUp, HiOutlineVolumeOff, HiOutlineInformationCircle } from 'react-icons/hi';
import { FaCoins, FaBomb } from 'react-icons/fa';
import { GiCrystalGrowth } from 'react-icons/gi';
import { useConfidentialGame } from '@/lib/inco/useConfidentialGame';
import { useMinesSession, minesStageCopy } from '@/lib/inco/useMinesSession';
import { minesMultiplier } from '@/lib/inco/payoutMath';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import BalanceChip from '@/components/treasury/BalanceChip';
import MinesHowToModal from './MinesHowToModal';
import WinConfetti from './WinConfetti';
import AIAutoBetting from './AIAutoBetting';

const GRID_SIZE = 5;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
const MAX_MINES = 10; // UI cap for a reasonable multiplier ladder — AptCasino.sol allows up to 24.
const MAX_PICKS = 10;

const SOUNDS = {
  click: '/sounds/click.mp3',
  gem: '/sounds/gem.mp3',
  explosion: '/sounds/explosion.mp3',
  win: '/sounds/win.mp3',
  bet: '/sounds/bet.mp3',
};

// Chance that the NEXT single pick is a mine, given `picks` already safely revealed
// out of `mines` mines among 25 tiles.
function nextPickMineChancePercent(mines, picks) {
  const remainingTiles = TOTAL_TILES - picks;
  if (remainingTiles <= 0) return 0;
  return Math.round((mines / remainingTiles) * 100);
}

export default function MinesBoard() {
  const gameHook = useConfidentialGame('mines');
  const session = useMinesSession({ treasury: gameHook.treasury });
  // AIAutoBetting's loop reads state across several awaits — a plain destructured
  // `session` would go stale mid-loop (closures don't see later renders). Refreshed
  // every render, before anything else, so the ref is always current by the time an
  // async continuation reads it.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [isMuted, setIsMuted] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [pendingTile, setPendingTile] = useState(null);
  const [bustedTile, setBustedTile] = useState(null);
  const audioRefs = { click: useRef(null), gem: useRef(null), explosion: useRef(null), win: useRef(null), bet: useRef(null) };
  const lastBustedRef = useRef(false);
  const lastPayoutRef = useRef(null);

  const minePositions = useMemo(
    () => (session.minePositions ? new Set(session.minePositions.map(Number)) : null),
    [session.minePositions],
  );
  const revealedSet = useMemo(() => new Set(session.revealedTiles), [session.revealedTiles]);
  const roundOver = session.busted || session.payout != null;
  const busy = ['approving', 'betting', 'revealing', 'settling'].includes(session.stage);
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
  }, [session.busted]);

  useEffect(() => {
    if (session.payout != null && lastPayoutRef.current !== session.payout) {
      playSound('win');
      toast.success(`Cashed out! Payout: ${(session.payout / 1_000_000).toFixed(4)} USDC`);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
    lastPayoutRef.current = session.payout;
  }, [session.payout]);

  useEffect(() => {
    if (session.stage === 'error' && session.error) toast.error(session.error);
  }, [session.stage, session.error]);

  async function handleStart() {
    playSound('bet');
    await session.start();
  }

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

  function handleNewRound() {
    setBustedTile(null);
    session.reset();
  }

  function adjustMines(delta) {
    if (session.active) return;
    session.setMineCount((current) => Math.max(1, Math.min(MAX_MINES, current + delta)));
  }

  function getCellVisual(index) {
    const isRevealedSafe = revealedSet.has(index);
    const isMine = minePositions?.has(index);
    const isPending = pendingTile === index;
    if (isPending) return { className: 'border-white/20 bg-white/10 animate-pulse', content: null };
    if (roundOver && isMine) {
      return {
        className: index === bustedTile ? 'border-red-500/80 bg-gradient-to-br from-red-800 to-red-950' : 'border-red-500/40 bg-gradient-to-br from-red-900/60 to-red-950/80',
        content: <BombImage />,
      };
    }
    if (isRevealedSafe) return { className: 'border-cyan-500/40 bg-gradient-to-br from-cyan-900/40 to-blue-900/50', content: <GemImage /> };
    return { className: 'border-white/10 bg-white/5 hover:bg-white/10', content: null };
  }

  const canReveal = session.active && !roundOver;

  return (
    <div className="relative flex w-full flex-col items-center">
      {Object.entries(SOUNDS).map(([key, src]) => <audio key={key} ref={audioRefs[key]} src={src} preload="auto" />)}
      {showConfetti && <WinConfetti />}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} closeOnClick pauseOnHover theme="dark" />
      <MinesHowToModal open={showInfo} onClose={() => setShowInfo(false)} totalTiles={TOTAL_TILES} />

      <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <BalanceChip treasury={gameHook.treasury} />
        <button type="button" onClick={() => session.setMode(session.mode === 'treasury' ? 'wallet' : 'treasury')} disabled={session.active} className="text-[11px] font-semibold text-white/45 underline decoration-dotted hover:text-white/70 disabled:opacity-40">
          {session.mode === 'treasury' ? 'Play from wallet instead' : 'Play from house balance instead'}
        </button>
      </div>

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
        <Stat label="Next-pick mine chance" value={`${chance}%`} valueClassName={chance > 50 ? 'text-red-400' : 'text-white'} />
        <Stat label="Multiplier" value={`${multiplier.toFixed(2)}x`} valueClassName="text-yellow-400" />
        <Stat label="Safe picks" value={`${session.revealedTiles.length} / ${Math.min(MAX_PICKS, TOTAL_TILES - session.mineCount)}`} valueClassName="text-white" />
      </div>

      <div className="relative mx-auto mb-3 w-full max-w-md">
        <div className="grid w-full gap-1.5" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
          {Array.from({ length: TOTAL_TILES }, (_, index) => {
            const visual = getCellVisual(index);
            const clickable = canReveal && pendingTile == null;
            return (
              <motion.button
                key={index}
                type="button"
                onClick={() => clickable && handleReveal(index)}
                disabled={!clickable}
                whileHover={{ scale: clickable ? 1.04 : 1 }}
                whileTap={{ scale: clickable ? 0.96 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className={`flex aspect-square items-center justify-center rounded-xl border shadow-md transition-colors duration-150 ${visual.className} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {visual.content}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="w-full space-y-2">
        {!gameHook.isConnected ? (
          <ConnectWalletButton className="w-full" />
        ) : !session.active && !roundOver ? (
          <button
            type="button"
            onClick={handleStart}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 py-3 font-bold text-white shadow-lg transition-all hover:from-purple-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaCoins className="text-yellow-300" />
            <span>{busy ? minesStageCopy[session.stage] : 'Start round'}</span>
          </button>
        ) : roundOver ? (
          <button type="button" onClick={handleNewRound} className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-3 font-bold text-white hover:bg-white/20">
            Play again
          </button>
        ) : (
          <button
            type="button"
            onClick={session.cashOut}
            disabled={session.revealedTiles.length === 0 || pendingTile != null}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 py-3 font-bold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaCoins className="text-yellow-300" />
            <span>Cash out {multiplier.toFixed(2)}x</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/45">Wager</label>
          <input className="game-input flex-1" type="number" min="0.1" max="10" step="0.1" value={session.wager} onChange={(e) => session.setWager(e.target.value)} disabled={session.active} />
          <span className="text-xs text-white/45">USDC</span>
        </div>
        {canReveal && (
          <p className="text-center text-xs text-white/40 flex items-center justify-center gap-1"><FaBomb className="text-red-400/70" /> Pick a tile, or cash out anytime once you've revealed at least one safe tile.</p>
        )}
      </div>

      <AIAutoBetting sessionRef={sessionRef} mode={session.mode} mineCount={session.mineCount} disabled={false} />

      <div className="mt-2 w-full">
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

function GemImage() {
  return <Image src="/images/diamond.png" alt="Gem" width={64} height={64} className="h-10 w-10 object-contain md:h-12 md:w-12" />;
}
function BombImage() {
  return <Image src="/images/bomb.png" alt="Mine" width={64} height={64} className="h-10 w-10 object-contain md:h-12 md:w-12" />;
}
