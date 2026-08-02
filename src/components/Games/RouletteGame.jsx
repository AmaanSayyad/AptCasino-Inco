'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import GameShell, { WagerAndPlay, ResultPanel, GameAside } from './GameShell';
import { useConfidentialGame } from '@/lib/inco/useConfidentialGame';
import { isRedNumber } from '@/lib/inco/payoutMath';

// Real European single-zero wheel order, used only for the spin animation.
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const POCKET_ANGLE = 360 / WHEEL_ORDER.length;

function pocketColor(n) {
  if (n === 0) return '#16a34a';
  return isRedNumber(n) ? '#dc2626' : '#111827';
}

export default function RouletteGame() {
  const hook = useConfidentialGame('roulette');
  const [betType, setBetType] = useState(0);
  const [selection, setSelection] = useState(7);
  const [rotation, setRotation] = useState(0);
  const spins = useRef(0);

  useEffect(() => {
    if (hook.stage === 'done' && hook.outcome) {
      const number = Number(hook.outcome.winningNumber);
      const pocketIndex = WHEEL_ORDER.indexOf(number);
      spins.current += 1;
      setRotation(spins.current * 360 * 3 - (pocketIndex * POCKET_ANGLE + POCKET_ANGLE / 2));
    }
  }, [hook.stage, hook.outcome]);

  function pickStraight(n) { setBetType(0); setSelection(n); }
  function pickOutside(type, sel) { setBetType(type); setSelection(sel); }
  function play() { hook.play([betType, selection]); }

  const gradient = `conic-gradient(from 0deg, ${WHEEL_ORDER.map((n, i) => `${pocketColor(n)} ${(i * POCKET_ANGLE).toFixed(2)}deg ${((i + 1) * POCKET_ANGLE).toFixed(2)}deg`).join(', ')})`;

  return (
    <GameShell game="roulette" aside={<GameAside game="roulette" hook={hook} />}>
      <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
        <div className="absolute -top-1 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-8 border-t-[14px] border-x-transparent border-t-white" />
        <motion.div className="h-52 w-52 rounded-full border-4 border-amber-300/40 shadow-xl" style={{ background: gradient }} animate={{ rotate: rotation }} transition={{ duration: 2.6, ease: [0.15, 0.85, 0.3, 1] }} />
        <div className="absolute h-9 w-9 rounded-full border border-white/30 bg-[#10000d]" />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-1 rounded-xl bg-emerald-950/40 p-2">
        <button type="button" onClick={() => pickStraight(0)} className={`col-span-3 rounded-md py-2 text-sm font-black text-white ${betType === 0 && selection === 0 ? 'ring-2 ring-amber-300' : ''}`} style={{ background: pocketColor(0) }}>0</button>
        {Array.from({ length: 12 }, (_, row) => (
          <div key={row} className="col-span-3 grid grid-cols-3 gap-1">
            {[row * 3 + 1, row * 3 + 2, row * 3 + 3].map((n) => (
              <button key={n} type="button" onClick={() => pickStraight(n)} className={`rounded-md py-2 text-sm font-black text-white transition ${betType === 0 && selection === n ? 'ring-2 ring-amber-300' : ''}`} style={{ background: pocketColor(n) }}>{n}</button>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1">
        {[0, 1, 2].map((col) => (
          <button key={col} type="button" onClick={() => pickOutside(5, col)} className={`game-input py-2 text-xs font-bold ${betType === 5 && selection === col ? 'ring-2 ring-amber-300' : ''}`}>Column {col + 1}</button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {['1st 12', '2nd 12', '3rd 12'].map((label, i) => (
          <button key={label} type="button" onClick={() => pickOutside(4, i)} className={`game-input py-2 text-xs font-bold ${betType === 4 && selection === i ? 'ring-2 ring-amber-300' : ''}`}>{label}</button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1">
        <button type="button" onClick={() => pickOutside(3, 0)} className={`game-input py-2 text-xs font-bold ${betType === 3 && selection === 0 ? 'ring-2 ring-amber-300' : ''}`}>1–18</button>
        <button type="button" onClick={() => pickOutside(2, 0)} className={`game-input py-2 text-xs font-bold ${betType === 2 && selection === 0 ? 'ring-2 ring-amber-300' : ''}`}>Even</button>
        <button type="button" onClick={() => pickOutside(1, 0)} className={`game-input py-2 text-xs font-bold text-red-400 ${betType === 1 && selection === 0 ? 'ring-2 ring-amber-300' : ''}`}>Red</button>
        <button type="button" onClick={() => pickOutside(1, 1)} className={`game-input py-2 text-xs font-bold ${betType === 1 && selection === 1 ? 'ring-2 ring-amber-300' : ''}`}>Black</button>
        <button type="button" onClick={() => pickOutside(2, 1)} className={`game-input py-2 text-xs font-bold ${betType === 2 && selection === 1 ? 'ring-2 ring-amber-300' : ''}`}>Odd</button>
        <button type="button" onClick={() => pickOutside(3, 1)} className={`game-input py-2 text-xs font-bold ${betType === 3 && selection === 1 ? 'ring-2 ring-amber-300' : ''}`}>19–36</button>
      </div>
      <p className="mt-3 text-xs text-white/45">Straight numbers pay 36×, dozens/columns 3×, the even-money outside bets 2× (minus the 3% house edge) — tap the table to choose.</p>

      <WagerAndPlay hook={hook} onPlay={play} />
      <ResultPanel game="roulette" hook={hook} />
    </GameShell>
  );
}
