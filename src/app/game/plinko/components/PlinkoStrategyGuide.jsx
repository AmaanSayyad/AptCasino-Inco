'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaShieldAlt, FaBalanceScale, FaBolt, FaLink } from 'react-icons/fa';

const LANES = [
  {
    id: 'grind',
    label: 'Grind',
    icon: FaShieldAlt,
    accent: 'emerald',
    title: 'Low risk · more rows',
    body: 'Flattest payout curve. Most drops land near the center with smaller multipliers — best for stretching a bankroll.',
    tip: 'Try 12–16 rows on Low when you want steady rounds.',
  },
  {
    id: 'balance',
    label: 'Balance',
    icon: FaBalanceScale,
    accent: 'amber',
    title: 'Medium risk',
    body: 'Wider spread than Low without High’s all-or-nothing edges. Center still soft; sides start to pay.',
    tip: 'Default setting for most sessions — readable variance.',
  },
  {
    id: 'spike',
    label: 'Spike',
    icon: FaBolt,
    accent: 'fuchsia',
    title: 'High risk · edge hunt',
    body: 'Payout concentrates on the two outer buckets. Middle drops usually lose — only wager what you can shrug off.',
    tip: 'Edge multipliers jump hard; hit rate stays tiny.',
  },
];

function laneClasses(accent, active) {
  if (!active) return 'border-white/10 bg-black/25 text-white/55 hover:border-white/20 hover:text-white/80';
  if (accent === 'emerald') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100';
  if (accent === 'amber') return 'border-amber-400/40 bg-amber-500/10 text-amber-100';
  return 'border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100';
}

export default function PlinkoStrategyGuide() {
  const [lane, setLane] = useState('grind');
  const active = LANES.find((l) => l.id === lane) ?? LANES[0];

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-black/40">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-red-magic to-blue-magic" />
          <h3 className="font-display text-lg font-semibold text-white sm:text-xl">Strategy Guide</h3>
        </div>
        <p className="max-w-2xl text-sm text-white/50">
          Pick a play style. Rows reshape variance — every table still carries the same 3% house edge.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {LANES.map((item) => {
            const Icon = item.icon;
            const on = item.id === lane;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setLane(item.id)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${laneClasses(item.accent, on)}`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="text-xs opacity-80" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div>
              <h4 className="font-display text-xl font-semibold text-white">{active.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{active.body}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
              <span className="font-semibold text-white/90">Tip · </span>
              {active.tip}
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-white/50">
              <FaLink className="mt-0.5 shrink-0 text-fuchsia-300" />
              Bucket outcomes come from Inco Lightning attestation + AptCasino settlement — verifiable on BaseScan after every drop.
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
