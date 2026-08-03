'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import GameWheel from '../../../components/wheel/GameWheel';
import BettingPanel from '../../../components/wheel/BettingPanel';
import { motion } from 'framer-motion';
import { FaChartLine, FaCoins, FaTrophy, FaPercentage, FaBalanceScale } from 'react-icons/fa';
import { GiWheelbarrow, GiSpinningBlades } from 'react-icons/gi';
import { HiOutlineChartBar } from 'react-icons/hi';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import BalanceChip from '@/components/treasury/BalanceChip';
import { useConfidentialGame } from '@/lib/inco/useConfidentialGame';
import { usdcAbi, usdcAddress, USDC_DECIMALS } from '@/lib/contracts/usdc';
import { rewardVaultAbi, rewardVaultAddress } from '@/lib/contracts/aptCasino';
import { basescanUrl } from '@/lib/baseSepolia';
import { buildExpandedWheelSegments, wheelRotationForSegmentIndex } from '@/lib/wheel/wheelSegments';
import WheelVideo from './components/WheelVideo';
import WheelDescription from './components/WheelDescription';
import WheelStrategyGuide from './components/WheelStrategyGuide';
import WheelProbability from './components/WheelProbability';
import WheelHistory from './components/WheelHistory';
import WheelLeaderboard from './components/WheelLeaderboard';

const RISK_INDEX = { low: 0, medium: 1, high: 2 };

export default function WheelPage() {
  const { address, isConnected } = useAccount();
  const game = useConfidentialGame('wheel');

  const [risk, setRisk] = useState('medium');
  const [noOfSegments, setSegments] = useState(20);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [wheelPosition, setWheelPosition] = useState(() => wheelRotationForSegmentIndex(0, buildExpandedWheelSegments('medium', 20).length));
  const [landedSegmentIndex, setLandedSegmentIndex] = useState(null);
  const [forcedSegmentIndex, setForcedSegmentIndex] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const spinTimeoutRef = useRef(null);

  const usdcBalance = useReadContract({
    address: usdcAddress, abi: usdcAbi, functionName: 'balanceOf', args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 10_000 },
  });
  const balanceFormatted = usdcBalance.data != null ? Number(formatUnits(usdcBalance.data, USDC_DECIMALS)) : 0;

  useEffect(() => {
    const wheel = buildExpandedWheelSegments(risk, noOfSegments);
    setWheelPosition(wheelRotationForSegmentIndex(0, wheel.length));
    setLandedSegmentIndex(null);
    setHasSpun(false);
  }, [risk, noOfSegments]);

  useEffect(() => {
    if (!address) { setGameHistory([]); return; }
    let cancelled = false;
    fetch(`/api/game-history?wallet=${encodeURIComponent(address)}&game=wheel&limit=50`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setGameHistory(j.history || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [address, hasSpun]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/games/stats').then((r) => r.json()).then((j) => {
      if (cancelled) return;
      const row = (j.stats || []).find((s) => s.game === 'wheel');
      setStats(row || { bets: 0, wagered: 0, paidOut: 0 });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const clearSpinTimeout = () => { if (spinTimeoutRef.current) { clearTimeout(spinTimeoutRef.current); spinTimeoutRef.current = null; } };
  useEffect(() => () => clearSpinTimeout(), []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Spins the wheel cosmetically to the already-known real segment, then reveals it. */
  function spinToRealSegment(segmentIndex) {
    return new Promise((resolve) => {
      setHasSpun(false);
      setLandedSegmentIndex(null);
      setForcedSegmentIndex(segmentIndex);
      setIsSpinning(true);
      clearSpinTimeout();
      spinTimeoutRef.current = setTimeout(() => {
        const wheel = buildExpandedWheelSegments(risk, noOfSegments);
        const idx = ((segmentIndex % wheel.length) + wheel.length) % wheel.length;
        setWheelPosition(wheelRotationForSegmentIndex(idx, wheel.length));
        setLandedSegmentIndex(idx);
        setIsSpinning(false);
        setHasSpun(true);
        resolve();
      }, 3200);
    });
  }

  async function placeBet() {
    if (game.mode === 'treasury') {
      const wagerRaw = Math.round(Number(game.wager) * 1_000_000);
      return game.playTreasury({ risk: RISK_INDEX[risk], segments: noOfSegments, wagerRaw });
    }
    return game.play([RISK_INDEX[risk], noOfSegments]);
  }

  async function manulBet() {
    if (!isConnected || !address) return;
    const response = await placeBet();
    if (!response) return; // hook already recorded the error
    await spinToRealSegment(Number(response.outcome.segment));
  }

  async function autoBet({ numberOfBets, winIncrease, lossIncrease, stopProfit, stopLoss }) {
    if (!isConnected || !address) return;
    const totalRounds = Math.max(1, Number(numberOfBets) || 10);
    let totalProfit = 0;
    const baseWager = game.wager;
    for (let i = 0; i < totalRounds; i += 1) {
      const before = Number(game.wager);
      const response = await placeBet();
      if (!response) break;
      await spinToRealSegment(Number(response.outcome.segment));
      const payoutAmount = Number(formatUnits(response.outcome.payout, USDC_DECIMALS));
      const profit = payoutAmount - before;
      totalProfit += profit;
      const next = profit > 0
        ? (winIncrease > 0 ? before * (1 + winIncrease) : Number(baseWager))
        : (lossIncrease > 0 ? before * (1 + lossIncrease) : Number(baseWager));
      game.setWager(String(Math.max(0.1, next)));
      if (stopProfit > 0 && totalProfit >= stopProfit) break;
      if (stopLoss > 0 && totalProfit <= -stopLoss) break;
    }
  }

  const renderHeader = () => (
    <div className="site-page-top relative text-white site-page-pad-x mb-8">
      <div className="absolute top-5 -right-32 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
      <div className="absolute top-28 left-1/3 w-32 h-32 bg-green-500/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-20 left-1/4 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl" />
      <div className="relative">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
          <div className="md:w-1/2">
            <div className="flex items-center">
              <div className="mr-3 p-3 bg-gradient-to-br from-red-900/40 to-red-700/10 rounded-lg shadow-lg shadow-red-900/10 border border-red-800/20">
                <GiWheelbarrow className="text-3xl text-red-300" />
              </div>
              <div>
                <motion.div className="flex items-center gap-2" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <p className="text-sm text-gray-400 font-sans">Games / Wheel</p>
                  <span className="text-xs px-2 py-0.5 bg-red-900/30 rounded-full text-red-300 font-display">Classic</span>
                  <span className="text-xs px-2 py-0.5 bg-green-900/30 rounded-full text-green-300 font-display">Live</span>
                </motion.div>
                <motion.h1 className="text-3xl md:text-4xl font-bold font-display bg-gradient-to-r from-red-300 to-amber-300 bg-clip-text text-transparent" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>Fortune Wheel</motion.h1>
              </div>
            </div>
            <motion.p className="text-white/70 mt-2 max-w-xl font-sans" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
              Place your bets and experience the thrill of the spinning wheel. Every outcome is settled confidentially on-chain via Inco Lightning, then verified before payout.
            </motion.p>
            <motion.div className="flex flex-wrap gap-4 mt-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
              <div className="flex items-center text-sm bg-gradient-to-r from-red-900/30 to-red-800/10 px-3 py-1.5 rounded-full"><FaPercentage className="mr-1.5 text-amber-400" /><span className="font-sans">Contract-defined house edge</span></div>
              <div className="flex items-center text-sm bg-gradient-to-r from-red-900/30 to-red-800/10 px-3 py-1.5 rounded-full"><GiSpinningBlades className="mr-1.5 text-blue-400" /><span className="font-sans">Multiple risk levels</span></div>
              <div className="flex items-center text-sm bg-gradient-to-r from-red-900/30 to-red-800/10 px-3 py-1.5 rounded-full"><FaBalanceScale className="mr-1.5 text-green-400" /><span className="font-sans">Provably fair via Inco</span></div>
            </motion.div>
          </div>
          <div className="md:w-1/2">
            <div className="bg-gradient-to-br from-red-900/20 to-red-800/5 rounded-xl p-4 border border-red-800/20 shadow-lg shadow-red-900/10">
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
              <motion.div className="flex flex-wrap justify-between gap-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                <button onClick={() => scrollToSection('strategy-guide')} className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-red-800/40 to-red-900/20 rounded-lg text-white font-medium text-sm hover:from-red-700/40 hover:to-red-800/20 transition-all duration-300">Strategy Guide</button>
                <button onClick={() => scrollToSection('probability')} className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-800/40 to-blue-900/20 rounded-lg text-white font-medium text-sm hover:from-blue-700/40 hover:to-blue-800/20 transition-all duration-300"><HiOutlineChartBar className="mr-2" />Probabilities</button>
                <button onClick={() => scrollToSection('history')} className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-800/40 to-purple-900/20 rounded-lg text-white font-medium text-sm hover:from-purple-700/40 hover:to-purple-800/20 transition-all duration-300"><FaChartLine className="mr-2" />Game History</button>
              </motion.div>
            </div>
          </div>
        </div>
        <div className="w-full h-0.5 bg-gradient-to-r from-red-600 via-blue-500/30 to-transparent mt-6" />
      </div>
    </div>
  );

  return (
    <div className="site-game-page bg-[#070005] text-white">
      {renderHeader()}

      <div className="site-page-pad-x relative z-10 pb-10">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-2/3">
            <GameWheel
              risk={risk}
              isSpinning={isSpinning}
              noOfSegments={noOfSegments}
              wheelPosition={wheelPosition}
              setWheelPosition={setWheelPosition}
              hasSpun={hasSpun}
              forcedSegmentIndex={forcedSegmentIndex}
              landedSegmentIndex={landedSegmentIndex}
            />
          </div>
          <div className="w-full lg:w-1/3 flex flex-col gap-4">
            {!isConnected ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl border border-[#333947]/80 bg-gradient-to-b from-[#290023] to-[#150012] p-8 text-center">
                <p className="text-white/70">Connect your Base wallet to play.</p>
                <ConnectWalletButton />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <BalanceChip treasury={game.treasury} />
                  <button
                    type="button"
                    onClick={() => game.setMode(game.mode === 'treasury' ? 'wallet' : 'treasury')}
                    className="text-[11px] font-semibold text-white/45 underline decoration-dotted hover:text-white/70"
                  >
                    {game.mode === 'treasury' ? 'Play from wallet instead' : 'Play from house balance instead'}
                  </button>
                </div>
                <BettingPanel
                  wager={game.wager}
                  setWager={game.setWager}
                  risk={risk}
                  setRisk={setRisk}
                  noOfSegments={noOfSegments}
                  setSegments={setSegments}
                  busy={game.busy || isSpinning}
                  onManualBet={manulBet}
                  onAutoBet={autoBet}
                  usdcBalance={balanceFormatted}
                />
              </>
            )}
            {game.error &&<p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{game.error}</p>}
            <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-200">Megapot progress</p>
              <p className="mt-1 text-2xl font-black">{game.credits} <span className="text-sm text-white/50">/ 1000</span></p>
              <button
                disabled={!game.vaultConfigured || game.credits < 1000 || game.claimPending || game.claimReceiptLoading}
                onClick={() => game.claim({ address: rewardVaultAddress, abi: rewardVaultAbi, functionName: 'claimTicket' })}
                className="mt-3 w-full rounded-xl bg-fuchsia-500 px-4 py-2.5 text-sm font-black disabled:opacity-40"
              >
                {game.claimPending || game.claimReceiptLoading ? 'Claiming…' : 'Claim Megapot ticket'}
              </button>
            </div>
            {game.settleHash && (
              <a className="text-center text-xs text-emerald-300 hover:underline" href={basescanUrl('tx', game.settleHash)} target="_blank" rel="noreferrer">View last settlement on BaseScan ↗</a>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-0 site-page-pad-x mt-4 mb-12">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-1/2"><WheelVideo /></div>
          <div className="w-full lg:w-1/2"><WheelDescription /></div>
        </div>
      </div>

      <div id="strategy-guide" className="site-page-pad-x my-12 scroll-mt-24">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-1/2"><WheelStrategyGuide /></div>
          <div id="probability" className="w-full lg:w-1/2 scroll-mt-24"><WheelProbability /></div>
        </div>
      </div>

      <div className="site-page-pad-x my-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <WheelLeaderboard />
          <div id="history" className="scroll-mt-24"><WheelHistory gameHistory={gameHistory} /></div>
        </div>
      </div>
    </div>
  );
}
