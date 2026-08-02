'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBomb, FaGem } from 'react-icons/fa';
import GameShell, { Field, WagerAndPlay, ResultPanel, GameAside } from './GameShell';
import { useConfidentialGame } from '@/lib/inco/useConfidentialGame';
import { minesMultiplier } from '@/lib/inco/payoutMath';

export default function MinesGame() {
  const hook = useConfidentialGame('mines');
  const [mineCount, setMineCount] = useState(5);
  const [tiles, setTiles] = useState([0, 6, 12]);
  const selectedTiles = useMemo(() => new Set(tiles), [tiles]);
  const minePositions = useMemo(() => hook.outcome ? new Set(hook.outcome.minePositions.map(Number)) : null, [hook.outcome]);
  const multiplier = minesMultiplier(mineCount, tiles.length || 1);

  function toggleTile(index) {
    if (hook.busy) return;
    setTiles((current) => current.includes(index) ? current.filter((v) => v !== index) : current.length < 10 ? [...current, index] : current);
  }

  function play() {
    if (tiles.length === 0) return;
    hook.play([tiles, mineCount]);
  }

  return (
    <GameShell game="mines" aside={<GameAside game="mines" hook={hook} />}>
      <Field label="Mine count"><input className="game-input" type="number" min="1" max="10" value={mineCount} onChange={(e) => setMineCount(Number(e.target.value))} /></Field>
      <div className="mt-5 grid max-w-lg grid-cols-5 gap-2">
        {Array.from({ length: 25 }, (_, index) => {
          const isMine = minePositions?.has(index);
          const isSelected = selectedTiles.has(index);
          const revealed = Boolean(hook.outcome);
          return (
            <button
              key={index}
              type="button"
              onClick={() => toggleTile(index)}
              disabled={hook.busy}
              className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border text-sm font-black transition ${
                revealed && isMine ? 'border-red-500 bg-red-500/20 text-red-300'
                  : revealed && isSelected ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
                  : isSelected ? 'border-amber-300 bg-amber-400 text-black'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={revealed ? (isMine ? 'mine' : isSelected ? 'safe' : 'empty') : (isSelected ? 'picked' : 'blank')}
                  initial={{ opacity: 0, rotateY: 90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {revealed && isMine ? <FaBomb /> : revealed && isSelected ? <FaGem /> : isSelected ? <FaGem /> : index + 1}
                </motion.span>
              </AnimatePresence>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-white/50">Choose 1–10 tiles. The mine map is generated only after the wager is locked.</p>
      <p className="mt-2 text-sm font-bold text-amber-300">Current payout if safe: {multiplier.toFixed(2)}×</p>
      <WagerAndPlay hook={hook} onPlay={play} disabled={tiles.length === 0} />
      <ResultPanel game="mines" hook={hook} />
    </GameShell>
  );
}
