'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronDown, FaInfoCircle } from 'react-icons/fa';
import { GiChestArmor } from 'react-icons/gi';
import { HiLightningBolt, HiOutlineTrendingUp, HiOutlineChartBar } from 'react-icons/hi';

export default function MinesStrategyGuide() {
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  return (
    <div id="strategy-guide" className="relative mt-8 overflow-hidden rounded-xl border-2 border-purple-700/30 bg-gradient-to-br from-[#290023]/80 to-[#150012]/90 p-6 shadow-xl shadow-purple-900/20 backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center font-display text-2xl font-bold text-white">
          <div className="mr-3 rounded-full border border-yellow-600/30 bg-gradient-to-br from-yellow-600/30 to-yellow-800/20 p-2.5 shadow-lg shadow-yellow-900/10">
            <GiChestArmor className="text-xl text-yellow-400" />
          </div>
          <span className="bg-gradient-to-r from-white to-yellow-300 bg-clip-text text-transparent">Strategy Guide</span>
        </h3>
        <button onClick={() => setIsStatsExpanded((v) => !v)} className="flex items-center gap-2 rounded-full border border-purple-800/30 bg-gradient-to-r from-purple-900/30 to-purple-800/20 px-4 py-1.5 text-sm text-white/80 transition-all hover:border-purple-700/40 hover:text-white">
          <span>{isStatsExpanded ? 'Show Less' : 'Show More'}</span>
          <FaChevronDown className={`text-purple-400 transition-transform ${isStatsExpanded ? 'rotate-180' : ''}`} size={12} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <StrategyCard icon={<HiLightningBolt className="text-yellow-400" />} accent="yellow" title="Beginner Strategy">
          Start with 1-3 mines and pick 3-5 tiles per round. This offers a good balance of risk and reward while you learn the game.
        </StrategyCard>
        <StrategyCard icon={<HiOutlineTrendingUp className="text-blue-400" />} accent="blue" title="Risk Management">
          Decide your target multiplier before confirming a round, and size your wager so a loss doesn't hurt your next round.
        </StrategyCard>
        <StrategyCard icon={<HiOutlineChartBar className="text-green-400" />} accent="green" title="Bankroll Management">
          Never wager more than 5% of your bankroll on a single round — this helps you recover from losing streaks.
        </StrategyCard>
      </div>

      <AnimatePresence>
        {isStatsExpanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-5 overflow-hidden">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/70">
              <div className="mb-2 flex items-center gap-2 text-white/90"><FaInfoCircle className="text-purple-400" /> Each round's mine layout is independent — pattern play across rounds is psychological, not mathematical. Every result is Inco-attested and verifiable on BaseScan.</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StrategyCard({ icon, accent, title, children }) {
  const accents = {
    yellow: 'from-yellow-900/20 to-yellow-800/5 border-yellow-800/30',
    blue: 'from-blue-900/20 to-blue-800/5 border-blue-800/30',
    green: 'from-green-900/20 to-green-800/5 border-green-800/30',
  };
  return (
    <motion.div whileHover={{ y: -5, scale: 1.02 }} className={`rounded-xl border bg-gradient-to-br p-5 transition-all duration-300 ${accents[accent]}`}>
      <h4 className="mb-3 flex items-center font-display text-lg font-semibold text-white">
        <div className="mr-3 rounded-full bg-black/20 p-2">{icon}</div>
        {title}
      </h4>
      <p className="font-sans text-sm text-white/80">{children}</p>
    </motion.div>
  );
}
