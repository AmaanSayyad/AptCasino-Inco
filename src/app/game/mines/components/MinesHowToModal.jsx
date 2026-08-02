'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaRegGem, FaBomb, FaCoins, FaTimes, FaChevronDown } from 'react-icons/fa';
import { GiMineTruck } from 'react-icons/gi';

const HOUSE_EDGE_PCT = 3; // Matches AptCasino.sol's *97/100 payout math.

export default function MinesHowToModal({ open, onClose, totalTiles }) {
  const [showFormula, setShowFormula] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const steps = [
    { icon: FaRegGem, iconClass: 'text-cyan-400', bg: 'from-cyan-500/15 to-blue-600/10 border-cyan-500/25', title: 'Pick tiles', body: 'Each selected tile raises your multiplier.' },
    { icon: FaBomb, iconClass: 'text-red-400', bg: 'from-red-500/15 to-orange-600/10 border-red-500/25', title: 'Avoid mines', body: 'If any pick hits a mine, the round loses.' },
    { icon: FaCoins, iconClass: 'text-amber-400', bg: 'from-amber-500/15 to-yellow-600/10 border-amber-500/25', title: 'Reveal', body: 'Confirm your picks — Inco settles the whole round at once.' },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="absolute inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="mines-how-to-title">
          <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-md" aria-label="Close how to play" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#1f0a1c]/95 to-[#0d0610]/98 shadow-2xl shadow-purple-900/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-blue-500" />
            <div className="p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/15">
                    <GiMineTruck className="text-xl text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 id="mines-how-to-title" className="text-lg font-bold leading-tight text-white">How to play</h3>
                    <p className="mt-0.5 text-sm text-white/55">5×5 grid · pick tiles · one confidential reveal</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close"><FaTimes /></button>
              </div>

              <div className="mb-4 grid gap-2.5 sm:grid-cols-3 sm:gap-2">
                {steps.map(({ icon: Icon, iconClass, bg, title, body }) => (
                  <div key={title} className={`rounded-xl border bg-gradient-to-br p-3 ${bg}`}>
                    <Icon className={`mb-2 text-lg ${iconClass}`} />
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-xs leading-snug text-white/60">{body}</p>
                  </div>
                ))}
              </div>

              <p className="mb-4 text-center text-xs text-white/50">More mines = higher risk and bigger multipliers on the ladder below.</p>

              <button type="button" onClick={() => setShowFormula((v) => !v)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10">
                <span>Payout formula &amp; house edge</span>
                <FaChevronDown className={`text-white/40 transition-transform ${showFormula ? 'rotate-180' : ''}`} />
              </button>
              {showFormula && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-2 overflow-hidden">
                  <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs">
                    <code className="mb-2 block break-all font-mono text-purple-200/90">fairMultiplier = {totalTiles} / ({totalTiles} − mines − picks) [combinatorial]</code>
                    <p className="leading-relaxed text-white/60">
                      Banked multiplier uses that fair value × <span className="text-amber-300/90">(1 − {HOUSE_EDGE_PCT}%)</span> — same ladder as the strip under the grid.
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition-all hover:from-purple-500 hover:to-blue-500">Got it</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
