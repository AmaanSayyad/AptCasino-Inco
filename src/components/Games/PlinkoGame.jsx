'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import GameShell, { Field, WagerAndPlay, ResultPanel, GameAside } from './GameShell';
import { useConfidentialGame } from '@/lib/inco/useConfidentialGame';
import { plinkoMultiplier } from '@/lib/inco/payoutMath';

function multiplierColor(multiplier) {
  if (multiplier < 1) return 'text-white/35';
  if (multiplier < 3) return 'text-sky-300';
  if (multiplier < 8) return 'text-fuchsia-300';
  return 'text-amber-300';
}

/** Fabricates a plausible left/right path ending at `bucket` — only the final
 * bucket is contractually meaningful, the intermediate path is cosmetic. */
function buildPath(rows, bucket) {
  const steps = Array.from({ length: rows }, (_, i) => i < bucket);
  for (let i = steps.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [steps[i], steps[j]] = [steps[j], steps[i]];
  }
  const positions = [50];
  let x = 50;
  steps.forEach((right) => {
    x += (right ? 1 : -1) * (50 / rows) * 0.9;
    positions.push(x);
  });
  return positions;
}

export default function PlinkoGame() {
  const hook = useConfidentialGame('plinko');
  const [risk, setRisk] = useState(1);
  const [rows, setRows] = useState(12);
  const [path, setPath] = useState(null);

  useEffect(() => {
    if (hook.stage === 'done' && hook.outcome) {
      setPath(buildPath(rows, Number(hook.outcome.bucket)));
    }
    if (hook.stage === 'idle') setPath(null);
  }, [hook.stage, hook.outcome, rows]);

  function play() {
    hook.play([risk, rows]);
  }

  const buckets = Array.from({ length: rows + 1 }, (_, i) => plinkoMultiplier(risk, rows, i));

  return (
    <GameShell game="plinko" aside={<GameAside game="plinko" hook={hook} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Risk"><select className="game-input" value={risk} onChange={(e) => setRisk(Number(e.target.value))}><option value="0">Low</option><option value="1">Medium</option><option value="2">High</option></select></Field>
        <Field label="Rows"><input className="game-input" type="range" min="8" max="16" value={rows} onChange={(e) => setRows(Number(e.target.value))} /><span className="text-sm text-white/60">{rows} rows</span></Field>
      </div>
      <div className="relative mt-6 h-56 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="flex h-full flex-col justify-between">
          {Array.from({ length: rows }, (_, row) => (
            <div key={row} className="flex justify-center gap-3">
              {Array.from({ length: row + 2 }, (_, peg) => <span key={peg} className="h-1.5 w-1.5 rounded-full bg-white/25" />)}
            </div>
          ))}
        </div>
        {path && (
          <motion.div
            className="absolute top-2 h-3 w-3 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_8px_2px_rgba(252,211,77,.6)]"
            initial={{ left: '50%', top: '0.5rem' }}
            animate={{ left: path.map((p) => `${p}%`), top: '90%' }}
            transition={{ duration: 1.8, ease: 'easeIn' }}
          />
        )}
      </div>
      <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${rows + 1}, minmax(0, 1fr))` }}>
        {buckets.map((m, i) => (
          <span key={i} className={`truncate rounded bg-white/5 px-0.5 py-1 text-center text-[10px] font-bold ${multiplierColor(m)} ${hook.outcome && Number(hook.outcome.bucket) === i ? 'ring-1 ring-amber-300' : ''}`}>
            {m.toFixed(1)}×
          </span>
        ))}
      </div>
      <WagerAndPlay hook={hook} onPlay={play} />
      <ResultPanel game="plinko" hook={hook} />
    </GameShell>
  );
}
