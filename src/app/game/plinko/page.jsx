'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GiRollingDices, GiCardRandom, GiPokerHand } from 'react-icons/gi';
import { FaPercentage, FaBalanceScale, FaChartLine, FaCoins, FaTrophy, FaBookOpen, FaCheckCircle } from 'react-icons/fa';
import PlinkoGame, { outcomeToBetSlot } from './components/PlinkoGame';
import GameControls from './components/GameControls';
import GameHistory from './components/GameHistory';
import PlinkoStrategyGuide from './components/PlinkoStrategyGuide';
import PlinkoWinProbabilities from './components/PlinkoWinProbabilities';
import PlinkoPayouts from './components/PlinkoPayouts';
import PlinkoLeaderboard from './components/PlinkoLeaderboard';
import { gameData } from './config/gameDetail';
import { parseUnits, formatUnits } from 'viem';
import { useConfidentialGame, stageCopy } from '@/lib/inco/useConfidentialGame';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';
import { riskLabelToIndex } from '@/lib/plinko/plinkoBoard';
import { basescanUrl } from '@/lib/baseSepolia';
import BalanceChip from '@/components/treasury/BalanceChip';
import PlayModeToggle from '@/components/treasury/PlayModeToggle';

function scrollToElement(id) {
  if (typeof window === 'undefined') return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function PlinkoHeader() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/games/stats').then((r) => r.json()).then((j) => {
      if (cancelled) return;
      const row = (j.stats || []).find((s) => s.game === 'plinko');
      setStats(row || { bets: 0, wagered: 0, paidOut: 0 });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="site-page-top site-page-pad-x relative mb-6 text-white md:mb-8">
      <div className="relative">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
          <div className="md:w-1/2">
            <div className="flex items-center">
              <div className="mr-3 p-3 bg-gradient-to-br from-purple-900/40 to-fuchsia-700/10 rounded-lg shadow-lg shadow-purple-900/10 border border-purple-800/20">
                <GiRollingDices className="text-3xl text-fuchsia-300" />
              </div>
              <div>
                <motion.div className="flex items-center gap-2" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <p className="text-sm text-gray-400 font-sans">Games / Plinko</p>
                  <span className="text-xs px-2 py-0.5 bg-purple-900/30 rounded-full text-purple-300 font-display">Classic</span>
                  <span className="text-xs px-2 py-0.5 bg-green-900/30 rounded-full text-green-300 font-display">Live</span>
                </motion.div>
                <motion.h1 className="text-3xl md:text-4xl font-bold font-display bg-gradient-to-r from-pink-300 to-amber-300 bg-clip-text text-transparent" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                  Plinko
                </motion.h1>
              </div>
            </div>
            <motion.p className="text-white/70 mt-2 max-w-xl font-sans" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
              Choose your bet, risk level and rows, then drop the ball and watch it bounce through the pegs to a multiplier slot.
            </motion.p>
            <motion.div className="flex flex-wrap gap-4 mt-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
              <div className="flex items-center text-sm bg-gradient-to-r from-purple-900/30 to-fuchsia-800/10 px-3 py-1.5 rounded-full"><FaPercentage className="mr-1.5 text-amber-400" /><span className="font-sans">Configurable risk</span></div>
              <div className="flex items-center text-sm bg-gradient-to-r from-purple-900/30 to-fuchsia-800/10 px-3 py-1.5 rounded-full"><GiPokerHand className="mr-1.5 text-blue-400" /><span className="font-sans">8–16 rows</span></div>
              <div className="flex items-center text-sm bg-gradient-to-r from-purple-900/30 to-fuchsia-800/10 px-3 py-1.5 rounded-full"><FaBalanceScale className="mr-1.5 text-green-400" /><span className="font-sans">Inco-verified</span></div>
            </motion.div>
          </div>
          <div className="md:w-1/2">
            <div className="bg-gradient-to-br from-purple-900/20 to-fuchsia-800/5 rounded-xl p-4 border border-purple-800/20 shadow-lg shadow-purple-900/10">
              <motion.div className="grid grid-cols-3 gap-2 mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }}>
                <div className="flex flex-col items-center p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600/20 mb-1"><FaChartLine className="text-blue-400" /></div>
                  <div className="text-xs text-white/50 font-sans text-center">Total Bets</div>
                  <div className="text-white font-display text-sm md:text-base">{stats ? stats.bets : '…'}</div>
                </div>
                <div className="flex flex-col items-center p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600/20 mb-1"><FaCoins className="text-yellow-400" /></div>
                  <div className="text-xs text-white/50 font-sans text-center">Volume</div>
                  <div className="text-white font-display text-sm md:text-base">{stats ? `${stats.wagered.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC` : '…'}</div>
                </div>
                <div className="flex flex-col items-center p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600/20 mb-1"><FaTrophy className="text-yellow-500" /></div>
                  <div className="text-xs text-white/50 font-sans text-center">Paid Out</div>
                  <div className="text-white font-display text-sm md:text-base">{stats ? `${stats.paidOut.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC` : '…'}</div>
                </div>
              </motion.div>
              <div className="flex flex-wrap justify-between gap-2">
                <button onClick={() => scrollToElement('strategy')} className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-800/40 to-fuchsia-900/20 rounded-lg text-white font-medium text-sm hover:from-purple-700/40 hover:to-fuchsia-800/20 transition-all duration-300"><GiCardRandom className="mr-2" />Strategy Guide</button>
                <button onClick={() => scrollToElement('payouts')} className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-800/40 to-blue-900/20 rounded-lg text-white font-medium text-sm hover:from-blue-700/40 hover:to-blue-800/20 transition-all duration-300"><FaCoins className="mr-2" />Payout Tables</button>
                <button onClick={() => scrollToElement('history')} className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-800/40 to-purple-900/20 rounded-lg text-white font-medium text-sm hover:from-purple-700/40 hover:to-purple-800/20 transition-all duration-300"><FaChartLine className="mr-2" />Game History</button>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full h-0.5 bg-gradient-to-r from-pink-600 via-blue-500/30 to-transparent mt-6" />
      </div>
    </div>
  );
}

export default function Plinko() {
  const [rows, setRows] = useState(16);
  const [riskLevel, setRiskLevel] = useState('High');
  const [recentBets, setRecentBets] = useState([]);
  const g = useConfidentialGame('plinko');

  async function placeBet() {
    const wagerRaw = parseUnits(g.wager, USDC_DECIMALS);
    const response = g.mode === 'treasury'
      ? await g.playTreasury({ risk: riskLabelToIndex(riskLevel), rows, wagerRaw: Number(wagerRaw) })
      : await g.play([riskLabelToIndex(riskLevel), rows]);
    if (response?.outcome) {
      setRecentBets((prev) => [outcomeToBetSlot(response.outcome, wagerRaw), ...prev].slice(0, 5));
    }
    return response;
  }

  async function manualBet() {
    await placeBet();
  }

  /** Real sequential auto-bet loop — each round fully settles on-chain before the next starts. */
  async function autoBet({ numberOfBets, winIncrease, lossIncrease, stopProfit, stopLoss }) {
    const totalRounds = Math.max(1, Number(numberOfBets) || 10);
    let totalProfit = 0;
    const baseWager = g.wager;
    for (let i = 0; i < totalRounds; i += 1) {
      const before = Number(g.wager);
      const response = await placeBet();
      if (!response) break;
      const payoutAmount = Number(formatUnits(response.outcome.payout, USDC_DECIMALS));
      const profit = payoutAmount - before;
      totalProfit += profit;
      const next = profit > 0
        ? (winIncrease > 0 ? before * (1 + winIncrease) : Number(baseWager))
        : (lossIncrease > 0 ? before * (1 + lossIncrease) : Number(baseWager));
      g.setWager(String(Math.max(0.1, next)));
      if (stopProfit > 0 && totalProfit >= stopProfit) break;
      if (stopLoss > 0 && totalProfit <= -stopLoss) break;
    }
  }

  return (
    <div className="site-game-page bg-[#070005] text-white">
      <PlinkoHeader />

      <div className="site-page-pad-x pb-8 sm:pb-12">
        <div className="flex flex-col xl:flex-row gap-4 sm:gap-8">
          <div className="w-full xl:w-1/4">
            <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <BalanceChip treasury={g.treasury} />
            </div>
            <div className="mb-3">
              <PlayModeToggle mode={g.mode} setMode={g.setMode} />
            </div>
            <GameControls
              wager={g.wager} setWager={g.setWager}
              riskLevel={riskLevel} setRiskLevel={setRiskLevel}
              rows={rows} setRows={setRows}
              onManualBet={manualBet} onAutoBet={autoBet} busy={g.busy} stageLabel={stageCopy[g.stage]}
            />
            {g.error && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{g.error}</p>}
            {g.outcome && g.stage === 'done' && (
              <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm">
                <p className="font-bold text-emerald-300">Bucket {g.outcome.bucket} · {(Number(g.outcome.multiplierBps) / 10000).toFixed(2)}x</p>
                <p className="text-white/60">Payout: {g.payout} USDC</p>
              </div>
            )}
            <div className="mt-4 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4 text-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-200">Megapot progress</p>
              <p className="mt-1 text-2xl font-black">{g.credits} <span className="text-sm text-white/50">/ 1000</span></p>
              <button disabled={!g.vaultConfigured || !g.canClaim || g.claimPending || g.claimReceiptLoading}
                onClick={() => g.claim({ address: g.rewardVaultAddress, abi: g.rewardVaultAbi, functionName: 'claimTicket' })}
                className="mt-3 w-full rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-black disabled:opacity-40">
                {g.claimPending || g.claimReceiptLoading ? 'Claiming…' : 'Claim Megapot ticket'}
              </button>
              {g.claimSucceeded && (
                <p className="mt-2 text-xs text-emerald-300">
                  Ticket claimed{g.claimTicketId ? ` (#${g.claimTicketId})` : ''} —{' '}
                  {g.claimTxHash ? <a href={basescanUrl('tx', g.claimTxHash)} target="_blank" rel="noreferrer" className="underline">view on BaseScan ↗</a> : 'minted to your wallet.'}
                </p>
              )}
              {g.claimError && <p className="mt-2 text-xs text-red-300">{g.claimError}</p>}
            </div>
          </div>
          <div className="w-full xl:w-3/4">
            <PlinkoGame rowCount={rows} riskLevel={riskLevel} busy={g.busy} stage={g.stage} outcome={g.outcome} recentBets={recentBets} stageLabel={stageCopy[g.stage]} />
          </div>
        </div>
      </div>

      <div className="site-page-pad-x pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border-2 border-purple-600/40 transition-all duration-300 hover:scale-[1.02] hover:border-purple-500/60" style={{ background: 'linear-gradient(135deg, rgba(104, 29, 219, 0.1), rgba(216, 38, 51, 0.05))', border: '2px solid rgba(104, 29, 219, 0.4)' }}>
              <iframe src={`https://www.youtube.com/embed/${gameData.youtube}`} title={`${gameData.title} Tutorial`} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" />
            </div>
          </div>
          <div className="relative bg-gradient-to-br from-[#1A0015]/95 to-[#0d0008]/90 rounded-xl border border-purple-700/30 p-6 text-gray-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-blue-500" />
            <div className="flex items-center gap-3 mb-5 pt-1">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500/30 to-purple-600/20 border border-purple-500/40 flex items-center justify-center shadow-lg shadow-purple-900/30"><FaBookOpen className="text-pink-300" size={18} /></div>
              <div>
                <h3 className="text-lg font-semibold bg-gradient-to-r from-white to-pink-300 bg-clip-text text-transparent">How to Play {gameData.title}</h3>
                <p className="text-xs text-white/50">Quick reference · drop, watch, win</p>
              </div>
            </div>
            <div className="space-y-3 text-sm leading-relaxed">
              {gameData.paragraphs.map((p, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-black/20 border border-purple-500/10 hover:border-purple-500/30 transition-colors">
                  <FaCheckCircle className="text-pink-400 mt-1 flex-shrink-0" size={14} />
                  <p className="text-gray-300">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="site-page-pad-x pb-12 scroll-mt-20" id="history">
        <div className="relative bg-gradient-to-br from-[#1A0015]/95 to-[#0d0008]/90 rounded-xl border border-purple-700/30 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-blue-500 z-10" />
          <div className="p-6 pt-7"><GameHistory /></div>
        </div>
      </div>

      <div className="site-page-pad-x pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 scroll-mt-20" id="strategy"><PlinkoStrategyGuide /></div>
          <div className="lg:col-span-1"><PlinkoWinProbabilities risk={riskLevel} rows={rows} /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 scroll-mt-20" id="payouts"><PlinkoPayouts /></div>
          <div className="lg:col-span-2"><PlinkoLeaderboard /></div>
        </div>
      </div>
    </div>
  );
}
