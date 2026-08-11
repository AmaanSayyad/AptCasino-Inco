'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaBullseye, FaLayerGroup, FaBalanceScale, FaArrowRight } from 'react-icons/fa';
import { ROULETTE_PAYOUT, rouletteCoveredPayout } from '@/lib/inco/payoutMath';

const BETS = [
  {
    id: 'even',
    name: 'Red / Black · Odd / Even · High / Low',
    short: 'Even money',
    covers: 18,
    probability: 48.65,
    payout: ROULETTE_PAYOUT.evenMoney,
    lane: 'safer',
    how: 'Bet a color, parity, or 1–18 / 19–36.',
  },
  {
    id: 'dozen',
    name: 'Dozen / Column',
    short: 'Dozen',
    covers: 12,
    probability: 32.43,
    payout: ROULETTE_PAYOUT.dozenOrColumn,
    lane: 'balanced',
    how: 'Any 12-number block — rows of dozens or a vertical column.',
  },
  {
    id: 'six',
    name: 'Six line',
    short: 'Six line',
    covers: 6,
    probability: 16.22,
    payout: rouletteCoveredPayout(6),
    lane: 'balanced',
    how: 'Two adjacent streets (six numbers).',
  },
  {
    id: 'corner',
    name: 'Corner',
    short: 'Corner',
    covers: 4,
    probability: 10.81,
    payout: rouletteCoveredPayout(4),
    lane: 'spicy',
    how: 'Four numbers meeting at a corner on the grid.',
  },
  {
    id: 'street',
    name: 'Street',
    short: 'Street',
    covers: 3,
    probability: 8.11,
    payout: rouletteCoveredPayout(3),
    lane: 'spicy',
    how: 'One horizontal row of three.',
  },
  {
    id: 'split',
    name: 'Split',
    short: 'Split',
    covers: 2,
    probability: 5.41,
    payout: rouletteCoveredPayout(2),
    lane: 'spicy',
    how: 'Two neighboring numbers sharing an edge.',
  },
  {
    id: 'straight',
    name: 'Straight up',
    short: 'Straight',
    covers: 1,
    probability: 2.7,
    payout: ROULETTE_PAYOUT.straight,
    lane: 'spicy',
    how: 'Single pocket — highest multiplier on the table.',
  },
];

const LANES = [
  {
    id: 'safer',
    label: 'Safer',
    icon: FaBalanceScale,
    tagline: 'Hit often, smaller returns',
    accent: 'emerald',
    tip: 'Best for stretching a bankroll. Zero still kills every even-money line.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    icon: FaLayerGroup,
    tagline: 'Mid hit-rate, mid payout',
    accent: 'amber',
    tip: 'Dozens and six-lines sit in the middle of the risk curve.',
  },
  {
    id: 'spicy',
    label: 'High reward',
    icon: FaBullseye,
    tagline: 'Rare hits, big multipliers',
    accent: 'fuchsia',
    tip: 'Straights and tight covers pay most — expect long dry spells.',
  },
];

const SAMPLE_BET = 1;

function fmtPct(n) {
  return `${n.toFixed(n >= 10 ? 1 : 2)}%`;
}

function fmtMult(n) {
  return `${n.toFixed(2)}×`;
}

function laneAccent(accent, active) {
  if (!active) return 'border-white/10 bg-black/20 text-white/55 hover:border-white/20 hover:text-white/80';
  if (accent === 'emerald') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100 shadow-[0_0_0_1px_rgba(52,211,153,0.12)]';
  if (accent === 'amber') return 'border-amber-400/40 bg-amber-500/10 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.12)]';
  return 'border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100 shadow-[0_0_0_1px_rgba(232,121,249,0.12)]';
}

function barTone(lane) {
  if (lane === 'safer') return 'from-emerald-400 to-teal-400';
  if (lane === 'balanced') return 'from-amber-400 to-orange-400';
  return 'from-fuchsia-400 to-red-magic';
}

export default function StrategyGuide() {
  const [lane, setLane] = useState('safer');
  const [selectedId, setSelectedId] = useState('even');

  const activeLane = LANES.find((l) => l.id === lane) ?? LANES[0];
  const filtered = useMemo(() => BETS.filter((b) => b.lane === lane), [lane]);
  const selected = BETS.find((b) => b.id === selectedId) ?? filtered[0] ?? BETS[0];

  const onPickLane = (id) => {
    setLane(id);
    const first = BETS.find((b) => b.lane === id);
    if (first) setSelectedId(first.id);
  };

  const sampleReturn = selected.payout * SAMPLE_BET;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-black/40">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-red-magic to-blue-magic" />
              <h3 className="font-display text-lg font-semibold text-white sm:text-xl">Strategy &amp; odds</h3>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-white/50">
              Pick a risk lane, then compare live multipliers (wheel edge + 3% contract fee already baked in).
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 lg:w-auto lg:min-w-[22rem]">
            {LANES.map((item) => {
              const Icon = item.icon;
              const active = item.id === lane;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPickLane(item.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition duration-200 ${laneAccent(item.accent, active)}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="text-xs opacity-80" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">{item.label}</span>
                  </div>
                  <p className={`mt-1 hidden text-[11px] leading-snug sm:block ${active ? 'text-white/70' : 'text-white/35'}`}>
                    {item.tagline}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Risk spectrum */}
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
            <span>More frequent</span>
            <span>Higher payout</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/80 via-amber-400/80 to-fuchsia-400/90" />
            <motion.div
              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-black shadow-lg"
              animate={{
                left: lane === 'safer' ? '12%' : lane === 'balanced' ? '48%' : '86%',
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              style={{ marginLeft: '-0.5rem' }}
            />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* Bet list */}
        <div className="border-b border-white/10 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <AnimatePresence mode="wait">
            <motion.div
              key={lane}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="space-y-2"
            >
              {filtered.map((bet) => {
                const active = bet.id === selected.id;
                return (
                  <button
                    key={bet.id}
                    type="button"
                    onClick={() => setSelectedId(bet.id)}
                    className={`group w-full rounded-xl border px-3.5 py-3 text-left transition duration-200 ${
                      active
                        ? 'border-white/20 bg-white/[0.07]'
                        : 'border-transparent bg-black/15 hover:border-white/10 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{bet.name}</p>
                        <p className="mt-0.5 text-[11px] text-white/40">
                          {bet.covers} of 37 pockets · {fmtPct(bet.probability)} hit
                        </p>
                      </div>
                      <p className="shrink-0 font-display text-lg font-bold tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-red-magic to-blue-magic">
                        {fmtMult(bet.payout)}
                      </p>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${barTone(bet.lane)}`}
                        initial={false}
                        animate={{ width: `${Math.min(100, bet.probability)}%` }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                      />
                    </div>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
          <p className="mt-4 text-xs leading-relaxed text-white/40">{activeLane.tip}</p>
        </div>

        {/* Detail panel */}
        <div className="relative p-5 sm:p-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                selected.lane === 'safer'
                  ? 'radial-gradient(circle at 80% 20%, rgba(52,211,153,0.18), transparent 55%)'
                  : selected.lane === 'balanced'
                    ? 'radial-gradient(circle at 80% 20%, rgba(251,191,36,0.16), transparent 55%)'
                    : 'radial-gradient(circle at 80% 20%, rgba(232,121,249,0.18), transparent 55%)',
            }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Selected bet</p>
              <h4 className="mt-1 font-display text-2xl font-semibold text-white">{selected.short}</h4>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{selected.how}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/25 px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Hit rate</p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">
                    {fmtPct(selected.probability)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/40">{selected.covers}/37 pockets</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Payout</p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-red-magic to-blue-magic">
                    {fmtMult(selected.payout)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/40">includes 3% fee</p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                  If {SAMPLE_BET} USDC wins
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-white/50">{SAMPLE_BET.toFixed(2)} USDC</span>
                  <FaArrowRight className="text-[10px] text-white/25" />
                  <span className="font-display text-xl font-bold tabular-nums text-emerald-300">
                    {sampleReturn.toFixed(2)} USDC
                  </span>
                  <span className="text-xs text-white/35">returned</span>
                </div>
              </div>

              {/* Pocket coverage visual */}
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/35">
                  <span>Wheel coverage</span>
                  <span>{selected.covers} lit</span>
                </div>
                <div className="grid grid-cols-[repeat(37,minmax(0,1fr))] gap-px rounded-lg bg-white/5 p-1">
                  {Array.from({ length: 37 }, (_, i) => (
                    <div
                      key={i}
                      className={`aspect-square rounded-[1px] sm:rounded-sm ${
                        i < selected.covers
                          ? selected.lane === 'safer'
                            ? 'bg-emerald-400/80'
                            : selected.lane === 'balanced'
                              ? 'bg-amber-400/80'
                              : 'bg-fuchsia-400/85'
                          : 'bg-white/[0.06]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
