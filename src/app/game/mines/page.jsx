'use client';

import { motion } from 'framer-motion';
import { FaBomb } from 'react-icons/fa';
import { GiMineExplosion, GiDiamonds, GiCrystalGrowth } from 'react-icons/gi';
import { usePlayWallet } from '@/lib/hooks/usePlayWallet';
import MinesBoard from './components/MinesBoard';
import MinesGameDetail from './components/MinesGameDetail';
import MinesProbability from './components/MinesProbability';
import MinesHistory from './components/MinesHistory';
import MinesLeaderboard from './components/MinesLeaderboard';
import MinesStrategyGuide from './components/MinesStrategyGuide';
import './mines.css';

const gameData = {
  description: 'Unearth hidden gems while avoiding mines in this thrilling confidential game!',
};

export default function MinesPage() {
  const { address, connected } = usePlayWallet();

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
            <MinesGameDetail />
            <MinesProbability />
          </div>

          <MinesHistory connected={connected} address={address} />
          <MinesLeaderboard />
          <MinesStrategyGuide />
        </div>
      </div>
    </motion.div>
  );
}
