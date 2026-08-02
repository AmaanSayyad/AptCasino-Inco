'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import GameShell, { Field, WagerAndPlay, ResultPanel, GameAside } from './GameShell';
import { useConfidentialGame } from '@/lib/inco/useConfidentialGame';
import { wheelMultiplier } from '@/lib/inco/payoutMath';

const SEGMENT_OPTIONS = [10, 20, 30, 40];

function multiplierColor(multiplier) {
  if (multiplier <= 0) return '#2a2a35';
  if (multiplier < 1) return '#3b82f6';
  if (multiplier < 3) return '#8b5cf6';
  if (multiplier < 8) return '#d946ef';
  return '#f59e0b';
}

function buildGradient(risk, segments) {
  const segAngle = 360 / segments;
  const stops = [];
  for (let i = 0; i < segments; i += 1) {
    const color = multiplierColor(wheelMultiplier(risk, i, segments));
    stops.push(`${color} ${(i * segAngle).toFixed(2)}deg ${((i + 1) * segAngle).toFixed(2)}deg`);
  }
  return `conic-gradient(from 0deg, ${stops.join(', ')})`;
}

export default function WheelGame() {
  const hook = useConfidentialGame('wheel');
  const [risk, setRisk] = useState(1);
  const [segments, setSegments] = useState(20);
  const [rotation, setRotation] = useState(0);
  const spins = useRef(0);
  const segAngle = 360 / segments;
  const gradient = useMemo(() => buildGradient(risk, segments), [risk, segments]);

  useEffect(() => {
    if (hook.stage === 'done' && hook.outcome) {
      const segment = Number(hook.outcome.segment);
      spins.current += 1;
      const target = spins.current * 360 * 3 - (segment * segAngle + segAngle / 2);
      setRotation(target);
    }
    if (hook.stage === 'idle') setRotation((r) => r % 360);
  }, [hook.stage, hook.outcome, segAngle]);

  function play() {
    hook.play([risk, segments]);
  }

  return (
    <GameShell game="wheel" aside={<GameAside game="wheel" hook={hook} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Risk"><select className="game-input" value={risk} onChange={(e) => setRisk(Number(e.target.value))}><option value="0">Low</option><option value="1">Medium</option><option value="2">High</option></select></Field>
        <Field label="Segments"><select className="game-input" value={segments} onChange={(e) => setSegments(Number(e.target.value))}>{SEGMENT_OPTIONS.map((n) => <option key={n}>{n}</option>)}</select></Field>
      </div>
      <div className="relative mx-auto mt-6 flex h-64 w-64 items-center justify-center">
        <div className="absolute -top-1 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-8 border-t-[14px] border-x-transparent border-t-white" />
        <motion.div
          className="h-56 w-56 rounded-full border-4 border-white/20 shadow-xl"
          style={{ background: gradient }}
          animate={{ rotate: rotation }}
          transition={{ duration: 2.4, ease: [0.15, 0.85, 0.3, 1] }}
        />
        <div className="absolute h-10 w-10 rounded-full border border-white/30 bg-[#10000d]" />
      </div>
      <p className="mt-4 text-center text-xs text-white/45">Wheel segments are colored by payout tier — gold is the jackpot lane, gray pays nothing.</p>
      <WagerAndPlay hook={hook} onPlay={play} />
      <ResultPanel game="wheel" hook={hook} />
    </GameShell>
  );
}
