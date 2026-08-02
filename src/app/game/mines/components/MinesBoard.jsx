'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { HiOutlineVolumeUp, HiOutlineVolumeOff, HiOutlineInformationCircle } from 'react-icons/hi';
import { FaCoins, FaBomb } from 'react-icons/fa';
import { GiCrystalGrowth } from 'react-icons/gi';
import { useConfidentialGame, stageCopy } from '@/lib/inco/useConfidentialGame';
import { minesMultiplier } from '@/lib/inco/payoutMath';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import MinesHowToModal from './MinesHowToModal';
import WinConfetti from './WinConfetti';

const GRID_SIZE = 5;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
const MAX_MINES = 10; // AptCasino.sol caps mineCount at 10 (original allowed up to 24 — contract limit now).
const MAX_PICKS = 10; // AptCasino.sol caps selectedTiles.length at 10.

const SOUNDS = {
  click: '/sounds/click.mp3',
  gem: '/sounds/gem.mp3',
  explosion: '/sounds/explosion.mp3',
  win: '/sounds/win.mp3',
  bet: '/sounds/bet.mp3',
};

// Chance that at least one of `picks` chosen tiles is a mine, out of `mines` mines among 25 tiles.
function mineChancePercent(mines, picks) {
  if (picks === 0) return 0;
  let safeCombos = 1;
  let totalCombos = 1;
  for (let i = 0; i < picks; i += 1) {
    safeCombos *= (TOTAL_TILES - mines - i);
    totalCombos *= (TOTAL_TILES - i);
  }
  const safeChance = totalCombos > 0 ? safeCombos / totalCombos : 0;
  return Math.round((1 - safeChance) * 100);
}

export default function MinesBoard() {
  const hook = useConfidentialGame('mines');
  const [mineCount, setMineCount] = useState(5);
  const [tiles, setTiles] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const audioRefs = { click: useRef(null), gem: useRef(null), explosion: useRef(null), win: useRef(null), bet: useRef(null) };
  const lastStageRef = useRef('idle');

  const selectedTiles = useMemo(() => new Set(tiles), [tiles]);
  const minePositions = useMemo(
    () => (hook.outcome ? new Set(hook.outcome.minePositions.map(Number)) : null),
    [hook.outcome],
  );
  const revealed = Boolean(hook.outcome) && hook.stage === 'done';
  const multiplier = tiles.length > 0 ? minesMultiplier(mineCount, tiles.length) : 1;
  const chance = mineChancePercent(mineCount, tiles.length);

  const multiplierLadder = useMemo(
    () => Array.from({ length: Math.min(MAX_PICKS, TOTAL_TILES - mineCount) }, (_, i) => ({
      tiles: i + 1,
      multiplier: minesMultiplier(mineCount, i + 1),
    })),
    [mineCount],
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
    if (lastStageRef.current === hook.stage) return;
    lastStageRef.current = hook.stage;
    if (hook.stage === 'done' && hook.outcome) {
      if (hook.outcome.hitMine) {
        playSound('explosion');
        toast.error('Game over! You hit a mine.');
      } else {
        playSound('win');
        toast.success(`Cleared! Payout: ${hook.payout} USDC`);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      }
    }
    if (hook.stage === 'error' && hook.error) {
      toast.error(hook.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hook.stage]);

  function toggleTile(index) {
    if (hook.busy) return;
    if (revealed) {
      // Starting a fresh round — clear the previous reveal first.
      setTiles([index]);
      return;
    }
    playSound('click');
    setTiles((current) => {
      if (current.includes(index)) return current.filter((v) => v !== index);
      if (current.length >= Math.min(MAX_PICKS, TOTAL_TILES - mineCount)) return current;
      return [...current, index];
    });
  }

  function adjustMines(delta) {
    if (hook.busy) return;
    setMineCount((current) => Math.max(1, Math.min(MAX_MINES, current + delta)));
  }

  function handlePlay() {
    if (tiles.length === 0) {
      toast.error('Select at least one tile first');
      return;
    }
    playSound('bet');
    hook.play([tiles, mineCount]);
  }

  function getCellVisual(index) {
    const isSelected = selectedTiles.has(index);
    const isMine = minePositions?.has(index);
    if (!revealed) {
      return { className: isSelected ? 'border-amber-300 bg-amber-400 text-black' : 'border-white/10 bg-white/5 hover:bg-white/10', content: isSelected ? <GemIcon /> : null };
    }
    if (isMine) return { className: 'border-red-500/60 bg-gradient-to-br from-red-900/80 to-red-950/90', content: <BombImage /> };
    if (isSelected) return { className: 'border-cyan-500/40 bg-gradient-to-br from-cyan-900/40 to-blue-900/50', content: <GemImage /> };
    return { className: 'border-white/8 bg-gradient-to-br from-[#141018] to-[#0c080f] opacity-60', content: null };
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
            <button className="bg-red-900/30 px-2 py-1 text-white hover:bg-red-900/50 disabled:opacity-50" onClick={() => adjustMines(-1)} disabled={hook.busy || mineCount <= 1}>-</button>
            <div className="px-3 py-1 font-medium text-white">{mineCount}</div>
            <button className="bg-green-900/30 px-2 py-1 text-white hover:bg-green-900/50 disabled:opacity-50" onClick={() => adjustMines(1)} disabled={hook.busy || mineCount >= MAX_MINES}>+</button>
          </div>
        </div>
      </div>

      <div className="mb-3 grid w-full grid-cols-3 gap-2">
        <Stat label="Chance of Mine" value={`${chance}%`} valueClassName={chance > 50 ? 'text-red-400' : 'text-white'} />
        <Stat label="Multiplier" value={`${multiplier.toFixed(2)}x`} valueClassName="text-yellow-400" />
        <Stat label="Picks" value={`${tiles.length} / ${Math.min(MAX_PICKS, TOTAL_TILES - mineCount)}`} valueClassName="text-white" />
      </div>

      <div className="relative mx-auto mb-3 w-full max-w-md">
        <div className="grid w-full gap-1.5" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
          {Array.from({ length: TOTAL_TILES }, (_, index) => {
            const visual = getCellVisual(index);
            const canPlay = !hook.busy && !revealed;
            return (
              <motion.button
                key={index}
                type="button"
                onClick={() => canPlay && toggleTile(index)}
                disabled={!canPlay}
                whileHover={{ scale: canPlay ? 1.04 : 1 }}
                whileTap={{ scale: canPlay ? 0.96 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className={`flex aspect-square items-center justify-center rounded-xl border shadow-md transition-colors duration-150 ${visual.className} ${canPlay ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {visual.content}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="w-full space-y-2">
        {!hook.isConnected ? (
          <ConnectWalletButton className="w-full" />
        ) : (
          <button
            type="button"
            onClick={handlePlay}
            disabled={hook.busy || (tiles.length === 0 && !revealed)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 py-3 font-bold text-white shadow-lg transition-all hover:from-purple-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaCoins className="text-yellow-300" />
            <span>{hook.busy ? stageCopy[hook.stage] : revealed ? 'Play again' : 'Reveal tiles'}</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/45">Wager</label>
          <input className="game-input flex-1" type="number" min="0.1" max="10" step="0.1" value={hook.wager} onChange={(e) => hook.setWager(e.target.value)} disabled={hook.busy} />
          <span className="text-xs text-white/45">USDC</span>
        </div>
      </div>

      <div className="mt-2 w-full">
        <h3 className="mb-2 flex items-center justify-between text-sm font-medium text-white/90">
          <span className="flex items-center"><GiCrystalGrowth className="mr-2 text-blue-400" />Multiplier ladder</span>
          <span className="text-[10px] font-normal text-white/40">{mineCount} mines</span>
        </h3>
        <div className="rounded-xl border border-gray-700/50 bg-black/40 p-3 shadow-lg">
          <div className="scrollbar-thin overflow-x-auto pb-1">
            <div className="flex min-w-max gap-3">
              {multiplierLadder.map((item) => (
                <div key={item.tiles} className={`min-w-[95px] rounded-lg p-2.5 text-center ${item.tiles === tiles.length ? 'border-2 border-purple-500/80 bg-gradient-to-br from-purple-700 to-purple-600 font-bold text-white shadow-lg shadow-purple-700/50' : 'border border-gray-700/50 bg-gradient-to-br from-gray-800/90 to-gray-900/90 text-white/90'}`}>
                  <div className="mb-1 text-xs font-medium">{item.tiles} Tiles</div>
                  <div className="text-xl font-semibold">{item.multiplier.toFixed(2)}x</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {revealed && (
        <div className="mt-4 w-full text-center">
          <a className="inline-block text-xs text-emerald-300 hover:underline" href={`https://sepolia.basescan.org/tx/${hook.settleHash}`} target="_blank" rel="noreferrer">
            Verify settlement on BaseScan ↗
          </a>
        </div>
      )}
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

function GemIcon() {
  return <div className="h-2 w-2 rounded-full bg-purple-400/50 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />;
}
function GemImage() {
  return <Image src="/images/diamond.png" alt="Gem" width={64} height={64} className="h-10 w-10 object-contain md:h-12 md:w-12" />;
}
function BombImage() {
  return <Image src="/images/bomb.png" alt="Mine" width={64} height={64} className="h-10 w-10 object-contain md:h-12 md:w-12" />;
}
