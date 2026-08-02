'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaHistory, FaTrophy, FaInfoCircle, FaChartLine, FaBomb, FaChevronDown } from 'react-icons/fa';
import { GiMineExplosion, GiDiamonds, GiCrystalGrowth, GiChestArmor } from 'react-icons/gi';
import { HiLightningBolt, HiOutlineTrendingUp, HiOutlineChartBar } from 'react-icons/hi';
import { usePlayWallet } from '@/lib/hooks/usePlayWallet';
import { minesMultiplier } from '@/lib/inco/payoutMath';
import MinesBoard from './components/MinesBoard';
import './mines.css';

const TOTAL_TILES = 25;

const gameData = {
  description: 'Unearth hidden gems while avoiding mines in this thrilling confidential game!',
};

const MINE_TABS = [1, 3, 5, 8, 10];

function winProbabilityRows() {
  return MINE_TABS.map((mines) => {
    const safeTiles = TOTAL_TILES - mines;
    return { mines, safeTiles, probability: Math.round((safeTiles / TOTAL_TILES) * 100) };
  });
}

export default function MinesPage() {
  const { address, connected } = usePlayWallet();
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [history, setHistory] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    if (!connected || !address) { setHistory([]); return; }
    fetch(`/api/game-history?wallet=${encodeURIComponent(address)}&game=mines&limit=20`)
      .then((r) => r.json()).then((j) => setHistory(j.history || [])).catch(() => {});
  }, [connected, address]);

  useEffect(() => {
    fetch('/api/leaderboard?game=mines&limit=10').then((r) => r.json()).then((j) => setLeaderboard(j.leaderboard || [])).catch(() => {});
  }, []);

  const probabilityRows = useMemo(winProbabilityRows, []);

  return (
    <motion.div className="site-game-page mines-bg custom-scrollbar bg-[#070005] bg-gradient-to-b from-[#070005] to-[#0e0512] text-white">
      <div className="site-page-top">
        {/* Header */}
        <div className="site-page-pad-x relative mb-8 text-white">
          <div className="absolute -right-32 top-5 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="absolute left-1/3 top-28 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="md:w-3/4">
                <div className="flex items-center">
                  <div className="mr-3 rounded-lg border border-purple-800/20 bg-gradient-to-br from-purple-900/40 to-purple-700/10 p-3 shadow-lg shadow-purple-900/10">
                    <GiMineExplosion className="text-3xl text-purple-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-sans text-sm text-gray-400">Games / Mines</p>
                      <span className="rounded-full bg-purple-900/30 px-2 py-0.5 font-display text-xs text-purple-300">Popular</span>
                      <span className="rounded-full bg-green-900/30 px-2 py-0.5 font-display text-xs text-green-300">Live</span>
                    </div>
                    <h1 className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text font-display text-3xl font-bold text-transparent md:text-4xl">Mines</h1>
                  </div>
                </div>
                <p className="mt-2 max-w-xl font-sans text-white/70">{gameData.description}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="flex items-center rounded-full bg-gradient-to-r from-purple-900/30 to-purple-800/10 px-3 py-1.5 text-sm">
                    <FaBomb className="mr-1.5 text-red-400" /><span className="font-sans">Up to 10 mines</span>
                  </div>
                  <div className="flex items-center rounded-full bg-gradient-to-r from-purple-900/30 to-purple-800/10 px-3 py-1.5 text-sm">
                    <GiDiamonds className="mr-1.5 text-blue-400" /><span className="font-sans">Customizable game grid</span>
                  </div>
                  <div className="flex items-center rounded-full bg-gradient-to-r from-purple-900/30 to-purple-800/10 px-3 py-1.5 text-sm">
                    <GiCrystalGrowth className="mr-1.5 text-green-400" /><span className="font-sans">Inco-verified fairness</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 h-0.5 w-full bg-gradient-to-r from-purple-600 via-blue-500/30 to-transparent" />
          </div>
        </div>

        {/* Game area */}
        <div className="site-page-pad-x flex flex-col gap-4 lg:flex-row">
          <motion.div
            className="w-full rounded-xl border-2 border-purple-700/30 bg-gradient-to-br from-[#290023]/80 to-[#150012]/90 p-6 shadow-xl shadow-purple-900/20 backdrop-blur-sm md:p-8"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          >
            <MinesBoard />
          </motion.div>
        </div>

        {/* Game info sections */}
        <div className="site-page-pad-x mt-10">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <InfoCard icon={<FaChartLine className="text-blue-400" />} title="Payout ladder">
              <p className="mb-3 text-sm text-white/60">Your potential payout increases with each tile you pick. More mines selected means higher risk and reward.</p>
              <div className="flex flex-wrap gap-2">
                {MINE_TABS.map((mines) => (
                  <div key={mines} className="rounded-lg border border-purple-800/20 bg-black/20 px-3 py-2 text-center">
                    <div className="text-xs text-white/45">{mines} mines · 1 pick</div>
                    <div className="text-sm font-bold text-yellow-400">{minesMultiplier(mines, 1).toFixed(2)}x</div>
                  </div>
                ))}
              </div>
            </InfoCard>
            <InfoCard icon={<HiOutlineChartBar className="text-green-400" />} title="Win probability" id="probability">
              <div className="space-y-2">
                {probabilityRows.map((row) => (
                  <div key={row.mines} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-white/60">{row.mines} mines</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600" style={{ width: `${row.probability}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right font-medium text-white/80">{row.probability}%</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/40">Chance the first pick is safe, per mine count.</p>
            </InfoCard>
          </div>

          <InfoCard icon={<FaHistory className="text-pink-400" />} title="Game history" id="history" className="mt-6">
            {!connected ? (
              <p className="text-sm text-white/50">Connect your wallet to see your history.</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-white/50">No rounds played yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="text-white/60">{new Date(h.created_at).toLocaleString()}</span>
                    <span className="font-semibold">{h.bet_raw ? (Number(h.bet_raw) / 1e6).toFixed(2) : '0'} USDC</span>
                    <span className={Number(h.payout_raw) > Number(h.bet_raw) ? 'text-emerald-300' : 'text-white/45'}>
                      {Number(h.payout_raw) > Number(h.bet_raw) ? '+' : ''}{(Number(h.payout_raw || 0) / 1e6).toFixed(2)} USDC
                    </span>
                    {h.proof_reference && (
                      <a className="text-xs text-emerald-300 hover:underline" href={`https://sepolia.basescan.org/tx/${h.proof_reference}`} target="_blank" rel="noreferrer">Verify ↗</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </InfoCard>

          <InfoCard icon={<FaTrophy className="text-yellow-400" />} title="Leaderboard" id="leaderboard" className="mt-6">
            {leaderboard.length === 0 ? <p className="text-sm text-white/50">No rounds recorded yet.</p> : (
              <div className="space-y-1.5">
                {leaderboard.slice(0, 10).map((row) => (
                  <div key={row.wallet} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="text-white/50">#{row.rank}</span>
                    <span className="truncate font-mono text-xs text-white/70">{row.wallet}</span>
                    <span className="font-semibold text-emerald-300">{(row.won / 1e6).toFixed(2)} USDC won</span>
                  </div>
                ))}
              </div>
            )}
          </InfoCard>

          {/* Strategy guide */}
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
        </div>
      </div>
    </motion.div>
  );
}

function InfoCard({ icon, title, id, className = '', children }) {
  return (
    <div id={id} className={`scroll-mt-24 rounded-xl border-2 border-purple-700/30 bg-gradient-to-br from-[#290023]/80 to-[#150012]/90 p-5 shadow-xl shadow-purple-900/20 backdrop-blur-sm ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-white">{icon}{title}</h3>
      {children}
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
