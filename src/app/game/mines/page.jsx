'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaHistory, FaTrophy, FaChartLine, FaBomb } from 'react-icons/fa';
import { GiMineExplosion, GiDiamonds, GiCrystalGrowth, GiCardRandom } from 'react-icons/gi';
import { HiOutlineChartBar } from 'react-icons/hi';
import { useConfidentialGame } from '@/lib/inco/useConfidentialGame';
import { useMinesSession } from '@/lib/inco/useMinesSession';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';
import { basescanUrl } from '@/lib/baseSepolia';
import MinesForm from './components/MinesForm';
import MinesBoard from './components/MinesBoard';
import MinesGameDetail from './components/MinesGameDetail';
import MinesBettingTable from './components/MinesBettingTable';
import MinesProbability from './components/MinesProbability';
import MinesHistory from './components/MinesHistory';
import MinesLeaderboard from './components/MinesLeaderboard';
import MinesStrategyGuide from './components/MinesStrategyGuide';
import './mines.css';

function scrollToElement(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Real stats from /api/games/stats + /api/leaderboard — no fabricated numbers. */
function useMinesStats() {
  const [stats, setStats] = useState({ bets: '…', volume: '…', maxWin: '…' });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/games/stats').then((r) => r.json()).catch(() => null),
      fetch('/api/leaderboard?game=mines').then((r) => r.json()).catch(() => null),
    ]).then(([statsRes, boardRes]) => {
      if (cancelled) return;
      const row = statsRes?.stats?.find((s) => s.game === 'mines');
      const maxWin = Math.max(0, ...(boardRes?.leaderboard ?? []).map((r) => Number(r.biggestWin) || 0));
      setStats({
        bets: row ? row.bets.toLocaleString() : '0',
        volume: row ? `${(row.wagered / 10 ** USDC_DECIMALS).toFixed(2)} USDC` : '0 USDC',
        maxWin: `${(maxWin / 10 ** USDC_DECIMALS).toFixed(2)} USDC`,
      });
    });
    return () => { cancelled = true; };
  }, []);
  return stats;
}

function MinesHeader() {
  const stats = useMinesStats();
  return (
    <div className="relative site-page-pad-x mb-8 text-white">
      <div className="absolute top-5 -right-32 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="absolute top-28 left-1/3 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
      <div className="absolute -bottom-20 left-1/4 h-48 w-48 rounded-full bg-pink-500/5 blur-3xl" />

      <div className="relative">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="md:w-3/4">
            <div className="flex items-center">
              <div className="mr-3 rounded-lg border border-purple-800/20 bg-gradient-to-br from-purple-900/40 to-purple-700/10 p-3 shadow-lg shadow-purple-900/10">
                <GiMineExplosion className="text-3xl text-purple-300" />
              </div>
              <div>
                <motion.div className="flex items-center gap-2" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <p className="font-sans text-sm text-gray-400">Games / Mines</p>
                  <span className="rounded-full bg-purple-900/30 px-2 py-0.5 font-display text-xs text-purple-300">Popular</span>
                  <span className="rounded-full bg-green-900/30 px-2 py-0.5 font-display text-xs text-green-300">Live</span>
                </motion.div>
                <motion.h1 className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text font-display text-3xl font-bold text-transparent md:text-4xl" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                  Mines
                </motion.h1>
              </div>
            </div>
            <motion.p className="mt-2 max-w-xl font-sans text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
              Unearth hidden gems while avoiding mines. Higher risk means higher rewards — can you beat the odds?
            </motion.p>
            <motion.div className="mt-4 flex flex-wrap gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
              <div className="flex items-center rounded-full bg-gradient-to-r from-purple-900/30 to-purple-800/10 px-3 py-1.5 text-sm">
                <FaBomb className="mr-1.5 text-red-400" /><span className="font-sans">Up to 10 mines</span>
              </div>
              <div className="flex items-center rounded-full bg-gradient-to-r from-purple-900/30 to-purple-800/10 px-3 py-1.5 text-sm">
                <GiDiamonds className="mr-1.5 text-blue-400" /><span className="font-sans">5x5 game grid</span>
              </div>
              <div className="flex items-center rounded-full bg-gradient-to-r from-purple-900/30 to-purple-800/10 px-3 py-1.5 text-sm">
                <GiCrystalGrowth className="mr-1.5 text-green-400" /><span className="font-sans">Inco-verified fairness</span>
              </div>
            </motion.div>
          </div>

          <div className="md:w-3/4">
            <div className="rounded-xl border border-purple-800/20 bg-gradient-to-br from-purple-900/20 to-purple-800/5 p-3 shadow-lg shadow-purple-900/10">
              <motion.div className="mb-4 grid grid-cols-3 gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }}>
                <div className="flex flex-col items-center rounded-lg bg-black/20 p-2">
                  <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/20"><FaChartLine className="text-blue-400" /></div>
                  <div className="text-center font-sans text-xs text-white/50">Total Bets</div>
                  <div className="font-display text-sm text-white md:text-base">{stats.bets}</div>
                </div>
                <div className="flex flex-col items-center rounded-lg bg-black/20 p-2">
                  <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-green-600/20"><FaChartLine className="text-yellow-400" /></div>
                  <div className="text-center font-sans text-xs text-white/50">Volume</div>
                  <div className="font-display text-sm text-white md:text-base">{stats.volume}</div>
                </div>
                <div className="flex flex-col items-center rounded-lg bg-black/20 p-2">
                  <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-red-600/20"><FaTrophy className="text-yellow-500" /></div>
                  <div className="text-center font-sans text-xs text-white/50">Max Win</div>
                  <div className="font-display text-sm text-white md:text-base">{stats.maxWin}</div>
                </div>
              </motion.div>
              <motion.div className="flex flex-wrap justify-between gap-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                <button onClick={() => scrollToElement('strategy-guide')} className="flex items-center justify-center rounded-lg bg-gradient-to-r from-purple-800/40 to-purple-900/20 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:from-purple-700/40 hover:to-purple-800/20">
                  <GiCardRandom className="mr-2" /> Strategy Guide
                </button>
                <button onClick={() => scrollToElement('probability')} className="flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-800/40 to-blue-900/20 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:from-blue-700/40 hover:to-blue-800/20">
                  <HiOutlineChartBar className="mr-2" /> Probabilities
                </button>
                <button onClick={() => scrollToElement('history')} className="flex items-center justify-center rounded-lg bg-gradient-to-r from-pink-800/40 to-pink-900/20 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:from-pink-700/40 hover:to-pink-800/20">
                  <FaHistory className="mr-2" /> Game History
                </button>
              </motion.div>
            </div>
          </div>
        </div>
        <div className="mt-6 h-0.5 w-full bg-gradient-to-r from-purple-600 via-blue-500/30 to-transparent" />
      </div>
    </div>
  );
}

export default function Mines() {
  const [showTutorial, setShowTutorial] = useState(false);
  const gameHook = useConfidentialGame('mines');
  const session = useMinesSession({ treasury: gameHook.treasury });
  const [isMuted, setIsMuted] = useState(false);
  const [pendingTile, setPendingTile] = useState(null);
  const [bustedTile, setBustedTile] = useState(null);
  const audioRefs = { click: useRef(null), gem: useRef(null), explosion: useRef(null), win: useRef(null), bet: useRef(null) };

  // A fresh session.start() clears busted/revealed tiles on the hook side; clear the
  // board's own busted-tile highlight (page-level UI state, not part of the session) too.
  useEffect(() => {
    if (session.active) setBustedTile(null);
  }, [session.active]);

  return (
    <div className="site-game-page mines-bg custom-scrollbar bg-[#070005] bg-gradient-to-b from-[#070005] to-[#0e0512] text-white">
      <div className="site-page-top">
        <MinesHeader />

        <div className="flex flex-col gap-4 site-page-pad-x lg:flex-row">
          {/* Betting form */}
          <div className="w-full lg:w-1/3 xl:w-1/4">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
              <MinesForm gameHook={gameHook} session={session} />
            </motion.div>
          </div>

          {/* Game board */}
          <motion.div
            className="relative w-full overflow-hidden rounded-xl border-2 border-purple-700/30 bg-gradient-to-br from-[#290023]/80 to-[#150012]/90 p-6 shadow-xl shadow-purple-900/20 backdrop-blur-sm md:p-8 lg:w-2/3 xl:w-3/4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute -z-10 top-0 right-0 h-80 w-80 rounded-full bg-purple-600/10 blur-3xl" />
            <div className="absolute -z-10 bottom-0 left-0 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
            <div className="relative z-10">
              <MinesBoard
                session={session}
                audioRefs={audioRefs}
                isMuted={isMuted}
                setIsMuted={setIsMuted}
                pendingTile={pendingTile}
                setPendingTile={setPendingTile}
                bustedTile={bustedTile}
                setBustedTile={setBustedTile}
              />
            </div>
          </motion.div>
        </div>

        <div className="mt-4 site-page-pad-x">
          <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-200">Megapot progress</p>
            <p className="mt-1 text-2xl font-black">{gameHook.credits} <span className="text-sm text-white/50">/ 1000</span></p>
            <button
              disabled={!gameHook.vaultConfigured || !gameHook.canClaim || gameHook.claimPending || gameHook.claimReceiptLoading}
              onClick={() => gameHook.claim()}
              className="mt-3 w-full rounded-xl bg-fuchsia-500 px-4 py-2.5 text-sm font-black disabled:opacity-40 md:w-auto"
            >
              {gameHook.claimPending || gameHook.claimReceiptLoading ? 'Claiming…' : 'Claim Megapot ticket'}
            </button>
            {gameHook.claimSucceeded && (
              <p className="mt-2 text-xs text-emerald-300">
                Ticket claimed{gameHook.claimTicketId ? ` (#${gameHook.claimTicketId})` : ''} —{' '}
                {gameHook.claimTxHash ? <a href={basescanUrl('tx', gameHook.claimTxHash)} target="_blank" rel="noreferrer" className="underline">view on BaseScan ↗</a> : 'minted to your wallet.'}
              </p>
            )}
            {gameHook.claimError && <p className="mt-2 text-xs text-red-300">{gameHook.claimError}</p>}
          </div>
        </div>

        <div className="mt-10 site-page-pad-x">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="mb-6 flex items-center gap-2 rounded-lg border border-purple-700/30 bg-purple-900/20 px-4 py-2 text-sm font-medium text-white/80 hover:text-white"
            >
              <GiMineExplosion className="text-purple-300" /> How to play Mines
            </button>
          </motion.div>

          <AnimatePresence>
            {showTutorial && (
              <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="w-full max-w-4xl rounded-xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-900/80 to-[#290023]/90 p-3 shadow-xl shadow-purple-900/20" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center font-display text-2xl font-bold text-white">
                      <GiMineExplosion className="mr-3 text-3xl text-purple-400" /> How to Play Mines
                    </h3>
                    <button onClick={() => setShowTutorial(false)} className="rounded-full bg-purple-800/30 p-2 text-white/70 hover:bg-purple-700/40 hover:text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="relative w-full overflow-hidden rounded-lg border border-purple-600/20 bg-black shadow-lg shadow-purple-900/30" style={{ paddingTop: '56.25%' }}>
                    <iframe className="absolute top-0 left-0 h-full w-full" src="https://www.youtube.com/embed/SJNWidJKOeA?si=SfKVKLsO_UyfGi5h" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
                  </div>
                  <p className="mt-3 text-sm text-white/70">
                    Choose your mine count, start a round, and reveal tiles on the 5x5 grid — each safe pick raises your multiplier. Cash out anytime, or risk it for a bigger payout. Every mine placement and reveal is settled on Base Sepolia via Inco confidential compute, with an attested reveal you can verify on BaseScan.
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <MinesGameDetail />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
              <MinesBettingTable />
            </motion.div>
          </div>

          <motion.div id="probability" className="mt-6 scroll-mt-24" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <MinesProbability />
          </motion.div>

          <motion.div id="history" className="mt-6 scroll-mt-24" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <MinesHistory connected={gameHook.isConnected} address={gameHook.address} />
          </motion.div>

          <motion.div id="leaderboard" className="mt-6 scroll-mt-24" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <MinesLeaderboard />
          </motion.div>

          <MinesStrategyGuide />
        </div>
      </div>

      <div id="diamond-particles" className="pointer-events-none fixed inset-0 z-0" />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(75, 30, 150, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.5); }
      `}</style>
    </div>
  );
}
