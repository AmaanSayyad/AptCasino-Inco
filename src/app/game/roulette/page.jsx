'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ClearIcon from '@mui/icons-material/Clear';
import UndoIcon from '@mui/icons-material/Undo';
import { motion } from 'framer-motion';
import { FaChartLine, FaCoins, FaTrophy, FaBalanceScale, FaPercentage, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { GiRollingDices, GiPokerHand, GiCardRandom } from 'react-icons/gi';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import BalanceChip from '@/components/treasury/BalanceChip';
import PlayModeToggle from '@/components/treasury/PlayModeToggle';
import { useConfidentialGame, stageCopy } from '@/lib/inco/useConfidentialGame';
import { isRedNumber } from '@/lib/inco/payoutMath';
import { basescanUrl } from '@/lib/baseSepolia';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';
import { muiStyles } from './styles';
import RouletteHistory from './components/RouletteHistory';
import RouletteLeaderboard from './components/RouletteLeaderboard';
import StrategyGuide from './components/StrategyGuide';
import RouletteGameIntro from './components/RouletteGameIntro';
import RoulettePayout from './components/RoulettePayout';
import WinProbabilities from './components/WinProbabilities';
import { RouletteInfoTriggers, RouletteInfoDialog } from './components/RouletteInfoPanel';

const theme = createTheme(muiStyles.dark);
const QUICK_BETS = [0.5, 1, 5, 10, 25, 50];
const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Real stats from /api/games/stats + /api/leaderboard — no fabricated numbers. */
function useRouletteStats() {
  const [stats, setStats] = useState({ bets: '…', volume: '…', maxWin: '…' });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/games/stats').then((r) => r.json()).catch(() => null),
      fetch('/api/leaderboard?game=roulette').then((r) => r.json()).catch(() => null),
    ]).then(([statsRes, boardRes]) => {
      if (cancelled) return;
      const row = statsRes?.stats?.find((s) => s.game === 'roulette');
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

function RouletteHeader() {
  const stats = useRouletteStats();
  return (
    <div className="site-page-top site-page-pad-x relative mb-6 text-white md:mb-8">
      <div className="absolute top-5 -right-32 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
      <div className="absolute top-28 left-1/3 w-32 h-32 bg-green-500/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-20 left-1/4 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl" />

      <div className="relative">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
          <div className="md:w-1/2">
            <div className="flex items-center">
              <div className="mr-3 p-3 bg-gradient-to-br from-red-900/40 to-red-700/10 rounded-lg shadow-lg shadow-red-900/10 border border-red-800/20">
                <GiRollingDices className="text-3xl text-red-300" />
              </div>
              <div>
                <motion.div className="flex items-center gap-2" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <p className="text-sm text-gray-400 font-sans">Games / Roulette</p>
                  <span className="text-xs px-2 py-0.5 bg-red-900/30 rounded-full text-red-300 font-display">Classic</span>
                  <span className="text-xs px-2 py-0.5 bg-green-900/30 rounded-full text-green-300 font-display">Live</span>
                </motion.div>
                <motion.h1 className="text-3xl md:text-4xl font-bold font-display bg-gradient-to-r from-red-300 to-amber-300 bg-clip-text text-transparent" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                  European Roulette
                </motion.h1>
              </div>
            </div>
            <motion.p className="text-white/70 mt-2 max-w-xl font-sans" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
              Place your bets and experience the thrill of the spinning wheel. From simple red/black bets to split, street, corner and six-line combinations, the choice is yours.
            </motion.p>
            <motion.div className="flex flex-wrap gap-4 mt-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
              <div className="flex items-center text-sm bg-gradient-to-r from-red-900/30 to-red-800/10 px-3 py-1.5 rounded-full">
                <FaPercentage className="mr-1.5 text-amber-400" />
                <span className="font-sans">2.70% house edge</span>
              </div>
              <div className="flex items-center text-sm bg-gradient-to-r from-red-900/30 to-red-800/10 px-3 py-1.5 rounded-full">
                <GiPokerHand className="mr-1.5 text-blue-400" />
                <span className="font-sans">Multiple betting options</span>
              </div>
              <div className="flex items-center text-sm bg-gradient-to-r from-red-900/30 to-red-800/10 px-3 py-1.5 rounded-full">
                <FaBalanceScale className="mr-1.5 text-green-400" />
                <span className="font-sans">Inco-verified fairness</span>
              </div>
            </motion.div>
          </div>

          <div className="md:w-1/2">
            <div className="bg-gradient-to-br from-red-900/20 to-red-800/5 rounded-xl p-4 border border-red-800/20 shadow-lg shadow-red-900/10">
              <motion.div className="grid grid-cols-3 gap-2 mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }}>
                <div className="flex flex-col items-center p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600/20 mb-1"><FaChartLine className="text-blue-400" /></div>
                  <div className="text-xs text-white/50 font-sans text-center">Total Bets</div>
                  <div className="text-white font-display text-sm md:text-base">{stats.bets}</div>
                </div>
                <div className="flex flex-col items-center p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600/20 mb-1"><FaCoins className="text-yellow-400" /></div>
                  <div className="text-xs text-white/50 font-sans text-center">Volume</div>
                  <div className="text-white font-display text-sm md:text-base">{stats.volume}</div>
                </div>
                <div className="flex flex-col items-center p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600/20 mb-1"><FaTrophy className="text-yellow-500" /></div>
                  <div className="text-xs text-white/50 font-sans text-center">Max Win</div>
                  <div className="text-white font-display text-sm md:text-base">{stats.maxWin}</div>
                </div>
              </motion.div>
              <motion.div className="flex flex-wrap justify-between gap-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                <button onClick={() => scrollToId('strategy')} className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-red-800/40 to-red-900/20 rounded-lg text-white font-medium text-sm hover:from-red-700/40 hover:to-red-800/20 transition-all duration-300">
                  <GiCardRandom className="mr-2" /> Strategy Guide
                </button>
                <button onClick={() => scrollToId('payouts')} className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-800/40 to-blue-900/20 rounded-lg text-white font-medium text-sm hover:from-blue-700/40 hover:to-blue-800/20 transition-all duration-300">
                  <FaCoins className="mr-2" /> Payout Tables
                </button>
                <button onClick={() => scrollToId('history')} className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-800/40 to-purple-900/20 rounded-lg text-white font-medium text-sm hover:from-purple-700/40 hover:to-purple-800/20 transition-all duration-300">
                  <FaChartLine className="mr-2" /> Game History
                </button>
              </motion.div>
            </div>
          </div>
        </div>
        <div className="w-full h-0.5 bg-gradient-to-r from-red-600 via-blue-500/30 to-transparent mt-6" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Real casino-table grid: a straight cell plus thin split/corner edge zones,
// exactly like a physical roulette felt. Which zone the player clicks decides
// the bet shape (straight / split / street / corner) — there's no separate
// "pick a shape" selector, matching how the original table worked.
// ---------------------------------------------------------------------------
function BetBox({ betValue = 0, betType = '', position = 'top-right', onClick }) {
  const pos = {
    'top-right': { top: '25%', left: '75%' },
    'top-left': { top: '25%', left: '25%' },
    'bottom-right': { top: '75%', left: '75%' },
    'bottom-left': { top: '75%', left: '25%' },
  }[position];
  return (
    <Tooltip title={<Typography>{betType}: {betValue}</Typography>} arrow placement="top">
      <Box
        onClick={onClick}
        sx={{
          position: 'absolute', ...pos, transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
          width: 26, height: 26, borderRadius: '50%', bgcolor: 'rgba(255,213,74,0.92)', border: '2px solid rgba(255,255,255,0.8)', boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
          '&:hover': { transform: 'translate(-50%, -50%) scale(1.1)' },
        }}
      >
        <Typography sx={{ fontSize: 12, color: '#1a1a1a', fontWeight: 800 }}>{betValue}</Typography>
      </Box>
    </Tooltip>
  );
}

// Real height comes from plain CSS aspect-ratio, not a JS width measurement —
// simpler and immune to the ResizeObserver/flex-stretch race that a
// measure-then-set-height approach (e.g. @visx/responsive's ParentSize) hits
// inside a doubly-nested flex grid like this table.
function GridInside({ insideNumber, topEdge, red, straightup, splitleft, splitbottom, corner, hasCorner, isWinner, placeBet }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {topEdge && <Box sx={{ height: 10, bgcolor: 'dark.card' }} />}
      <Box
        sx={{
          position: 'relative', display: 'flex', alignItems: 'stretch', width: '100%', aspectRatio: '1 / 1',
          ...(red && { bgcolor: 'game.red' }),
          ...(isWinner && { boxShadow: '0 0 15px 5px rgba(255,215,0,0.7)', zIndex: 3 }),
          transition: 'all .2s ease',
          '&:hover': { transform: 'scale(1.02)', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', zIndex: 2 },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', width: 10 }}>
          <Box sx={{ position: 'relative', flex: 1, bgcolor: 'dark.card', cursor: 'pointer' }} onClick={() => placeBet('split-left', insideNumber)}>
            {splitleft > 0 && <BetBox betValue={splitleft} betType="Split" position="top-right" onClick={() => placeBet('split-left', insideNumber)} />}
          </Box>
          {hasCorner && (
            <Box sx={{ position: 'relative', height: 10, bgcolor: 'dark.card', cursor: 'pointer' }} onClick={() => placeBet('corner', insideNumber)}>
              {corner > 0 && <BetBox betValue={corner} betType="Corner" position="bottom-right" onClick={() => placeBet('corner', insideNumber)} />}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <Box sx={{ position: 'relative', flex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }} onClick={() => placeBet('straight', insideNumber)}>
            <Typography variant="h5" sx={{ position: 'relative', zIndex: 4, textShadow: '0 0 4px rgba(0,0,0,0.8)', fontWeight: 'bold', bgcolor: 'rgba(0,0,0,0.4)', px: 0.75, borderRadius: 1, transform: 'translateX(-10%)' }}>
              {insideNumber}
            </Typography>
            {straightup > 0 && <BetBox betValue={straightup} betType="Straight up" position="top-right" onClick={() => placeBet('straight', insideNumber)} />}
          </Box>
          <Box sx={{ position: 'relative', flex: 1, bgcolor: 'dark.card', maxHeight: 10, minHeight: 10, cursor: 'pointer' }} onClick={() => placeBet('bottom', insideNumber)}>
            {splitbottom > 0 && <BetBox betValue={splitbottom} betType="Split/Street" position="bottom-right" onClick={() => placeBet('bottom', insideNumber)} />}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function GridZero({ amount, isWinner, placeBet }) {
  return (
    <Box
      onClick={() => placeBet('zero')}
      sx={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', cursor: 'pointer',
        clipPath: 'polygon(100% 0%, 100% 100%, 40% 100%, 0% 50%, 40% 0%)', bgcolor: 'game.green',
        ...(isWinner && { boxShadow: '0 0 15px 5px rgba(255,215,0,0.7)', zIndex: 3 }),
      }}
    >
      <Typography variant="h5">0</Typography>
      {amount > 0 && <BetBox betValue={amount} betType="Straight up" onClick={() => placeBet('zero')} />}
    </Box>
  );
}

function GridColumnBet({ topCard, bottomCard, index, amount, placeBet }) {
  return (
    <Box
      onClick={() => placeBet('column', index)}
      sx={{
        position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', bgcolor: 'dark.button',
        borderTop: (t) => `${topCard ? 10 : 5}px solid ${t.palette.dark.card}`,
        borderBottom: (t) => `${bottomCard ? 10 : 5}px solid ${t.palette.dark.card}`,
        borderRight: (t) => `10px solid ${t.palette.dark.card}`,
        borderLeft: (t) => `10px solid ${t.palette.dark.card}`,
      }}
    >
      <Typography variant="h5">2 To 1</Typography>
      {amount > 0 && <BetBox betValue={amount} betType={`2 To 1 (row ${index + 1})`} onClick={() => placeBet('column', index)} />}
    </Box>
  );
}

function GridOutsideBet({ rightCard, onClick, children }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2, cursor: 'pointer', bgcolor: 'dark.button',
        borderBottom: (t) => `10px solid ${t.palette.dark.card}`,
        borderLeft: (t) => `10px solid ${t.palette.dark.card}`,
        ...(rightCard && { borderRight: (t) => `10px solid ${t.palette.dark.card}` }),
        transition: 'all .3s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' },
      }}
    >
      {children}
    </Box>
  );
}

// Table layout: three "thirds" (1-12, 13-24, 25-36), each 4 columns wide x 3 rows
// tall — top row holds the highest multiple of 3 in each group, bottom row (next
// to zero) the lowest. This matches a real felt, not a simple vertical list.
const firstThird = [
  { val: 3, red: true }, { val: 6 }, { val: 9, red: true }, { val: 12 },
  { val: 2 }, { val: 5, red: true }, { val: 8 }, { val: 11 },
  { val: 1, red: true }, { val: 4 }, { val: 7, red: true }, { val: 10 },
];
const secondThird = [
  { val: 15 }, { val: 18, red: true }, { val: 21, red: true }, { val: 24 },
  { val: 14, red: true }, { val: 17 }, { val: 20 }, { val: 23, red: true },
  { val: 13 }, { val: 16, red: true }, { val: 19, red: true }, { val: 22 },
];
const thirdThird = [
  { val: 27, red: true }, { val: 30, red: true }, { val: 33 }, { val: 36, red: true },
  { val: 26 }, { val: 29 }, { val: 32, red: true }, { val: 35 },
  { val: 25, red: true }, { val: 28 }, { val: 31 }, { val: 34, red: true },
];

// Left-split partner for a number (the number 3 rows "up" in the same lane, or 0
// for numbers 1-3). Bottom-edge partner is a street when the number sits on the
// bottom row (next to zero), otherwise a split with the number one below it.
// Corner numbers only exist to the left of the 2nd/3rd column in each row.
const SPLIT_LEFT = { 1: [0, 1], 2: [0, 2], 3: [0, 3], 4: [1, 4], 7: [4, 7], 10: [7, 10], 13: [10, 13], 16: [13, 16], 19: [16, 19], 22: [19, 22], 25: [22, 25], 28: [25, 28], 31: [28, 31], 34: [31, 34], 5: [2, 5], 8: [5, 8], 11: [8, 11], 14: [11, 14], 17: [14, 17], 20: [17, 20], 23: [20, 23], 26: [23, 26], 29: [26, 29], 32: [29, 32], 35: [32, 35], 6: [3, 6], 9: [6, 9], 12: [9, 12], 15: [12, 15], 18: [15, 18], 21: [18, 21], 24: [21, 24], 27: [24, 27], 30: [27, 30], 33: [30, 33], 36: [33, 36] };
const BOTTOM_ROW = new Set([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
const BOTTOM_SPLIT = { 2: [1, 2], 3: [2, 3], 5: [4, 5], 6: [5, 6], 8: [7, 8], 9: [8, 9], 11: [10, 11], 12: [11, 12], 14: [13, 14], 15: [14, 15], 17: [16, 17], 18: [17, 18], 20: [19, 20], 21: [20, 21], 23: [22, 23], 24: [23, 24], 26: [25, 26], 27: [26, 27], 29: [28, 29], 30: [29, 30], 32: [31, 32], 33: [32, 33], 35: [34, 35], 36: [35, 36] };
const CORNER = { 2: [0, 1, 2], 5: [1, 2, 4, 5], 8: [4, 5, 7, 8], 11: [7, 8, 10, 11], 14: [10, 11, 13, 14], 17: [13, 14, 16, 17], 20: [16, 17, 19, 20], 23: [19, 20, 22, 23], 26: [22, 23, 25, 26], 29: [25, 26, 28, 29], 32: [28, 29, 31, 32], 35: [31, 32, 34, 35], 3: [0, 2, 3], 6: [2, 3, 5, 6], 9: [5, 6, 8, 9], 12: [8, 9, 11, 12], 15: [11, 12, 14, 15], 18: [14, 15, 17, 18], 21: [17, 18, 20, 21], 24: [20, 21, 23, 24], 27: [23, 24, 26, 27], 30: [26, 27, 29, 30], 33: [29, 30, 32, 33], 36: [32, 33, 35, 36] };

function betKey(shape) {
  return shape.betType === 6 ? `6:${[...shape.numbers].sort((a, b) => a - b).join(',')}` : `${shape.betType}:${shape.selection ?? 0}`;
}

// Every distinct wager bucket the table can hold — red/black/odd/even/high-low as
// scalars, dozens/columns as 3-slots, every number's straight/split/street/corner
// folded into one `chips` map keyed by contract (betType, selection|numbers).
const arrayReducer = (state, action) => {
  switch (action.type) {
    case 'reset': return new Array(state.length).fill(0);
    case 'update': { const next = [...state]; next[action.ind] = action.val; return next; }
    default: return state;
  }
};

function BettingStats({ rounds }) {
  const stats = useMemo(() => {
    if (rounds.length === 0) return null;
    const wins = rounds.filter((r) => r.payout > r.wager);
    const totalWagered = rounds.reduce((s, r) => s + r.wager, 0);
    const netProfit = rounds.reduce((s, r) => s + (r.payout - r.wager), 0);
    const counts = new Map();
    for (const r of rounds) counts.set(r.number, (counts.get(r.number) ?? 0) + 1);
    const hotNumbers = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([number]) => number);
    return { winRate: ((wins.length / rounds.length) * 100).toFixed(1), rounds: rounds.length, winCount: wins.length, netProfit, hotNumbers };
  }, [rounds]);

  if (!stats) return null;
  return (
    <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, bgcolor: 'rgba(0,0,0,0.3)' }}>
      <Typography variant="subtitle1" color="white" sx={{ mb: 1, fontWeight: 700 }}>Session Statistics</Typography>
      <Grid container spacing={1}>
        <Grid xs={6} md={4}>
          <Typography variant="caption" color="text.secondary">Win Rate</Typography>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{stats.winRate}%</Typography>
          <Typography variant="caption" color="text.secondary">{stats.winCount}/{stats.rounds} rounds</Typography>
        </Grid>
        <Grid xs={6} md={4}>
          <Typography variant="caption" color="text.secondary">Rounds</Typography>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{stats.rounds}</Typography>
        </Grid>
        <Grid xs={6} md={4}>
          <Typography variant="caption" color="text.secondary">P/L</Typography>
          <Typography variant="h6" color={stats.netProfit >= 0 ? 'success.main' : 'error.main'} sx={{ lineHeight: 1.2 }}>
            {stats.netProfit >= 0 ? '+' : ''}{stats.netProfit.toFixed(2)} USDC
          </Typography>
        </Grid>
        <Grid xs={12}>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>Hot Numbers</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
            {stats.hotNumbers.map((n) => (
              <Box key={n} sx={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: n === 0 ? 'game.green' : RED_SET.has(n) ? 'game.red' : 'dark.bg', border: '1px solid rgba(255,255,255,0.2)' }}>
                <Typography variant="caption" fontWeight="bold">{n}</Typography>
              </Box>
            ))}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function RoulettePage() {
  const hook = useConfidentialGame('roulette');

  const [bet, setBet] = useState(1);
  const [inside, dispatchInside] = useReducer(arrayReducer, new Array(148).fill(0));
  const [red, setRed] = useState(0);
  const [black, setBlack] = useState(0);
  const [odd, setOdd] = useState(0);
  const [even, setEven] = useState(0);
  const [over, setOver] = useState(0);
  const [under, setUnder] = useState(0);
  const [dozens, dispatchDozens] = useReducer(arrayReducer, [0, 0, 0]);
  const [columns, dispatchColumns] = useReducer(arrayReducer, [0, 0, 0]);
  const [history, setHistory] = useState([]); // events for undo
  const [rounds, setRounds] = useState([]); // session stats
  const [recentResults, setRecentResults] = useState([]);
  const [helpPanel, setHelpPanel] = useState(null);
  const [roundDismissed, setRoundDismissed] = useState(true);
  const [warning, setWarning] = useState('');

  const spinSoundRef = useRef(null);
  const winSoundRef = useRef(null);
  const chipSelectRef = useRef(null);
  const chipPlaceRef = useRef(null);
  const menuClickRef = useRef(null);
  const backgroundMusicRef = useRef(null);
  const ambientSoundsRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    for (const ref of [spinSoundRef, winSoundRef, chipSelectRef, chipPlaceRef, menuClickRef, backgroundMusicRef, ambientSoundsRef]) {
      if (ref.current) ref.current.muted = isMuted;
    }
    if (isMuted) { backgroundMusicRef.current?.pause(); ambientSoundsRef.current?.pause(); }
    else { backgroundMusicRef.current?.play().catch(() => {}); ambientSoundsRef.current?.play().catch(() => {}); }
  }, [isMuted]);

  const playSound = useCallback((ref) => {
    if (!ref?.current || ref.current.muted) return;
    ref.current.currentTime = 0;
    ref.current.play().catch(() => {});
  }, []);

  // placeBet accumulates `bet` onto whichever bucket the player clicked, and
  // records an undo entry — same accumulation model as a real table where chips
  // stack until the round is spun or the stack is cleared.
  const placeBet = useCallback((kind, target) => {
    playSound(chipPlaceRef);
    if (kind === 'zero') {
      const old = inside[0];
      dispatchInside({ type: 'update', ind: 0, val: old + bet });
      setHistory((h) => [...h, { kind, target, old }]);
      return;
    }
    if (kind === 'straight' || kind === 'split-left' || kind === 'bottom' || kind === 'corner') {
      const offset = kind === 'straight' ? 1 : kind === 'split-left' ? 2 : kind === 'bottom' ? 3 : 4;
      if (kind === 'corner' && !CORNER[target]) return;
      const ind = (target - 1) * 4 + offset;
      const old = inside[ind];
      dispatchInside({ type: 'update', ind, val: old + bet });
      setHistory((h) => [...h, { kind, target, old, ind }]);
      return;
    }
    if (kind === 'column') {
      const old = columns[target];
      dispatchColumns({ type: 'update', ind: target, val: old + bet });
      setHistory((h) => [...h, { kind, target, old }]);
      return;
    }
    if (kind === 'dozen') {
      const old = dozens[target];
      dispatchDozens({ type: 'update', ind: target, val: old + bet });
      setHistory((h) => [...h, { kind, target, old }]);
      return;
    }
    const setter = { red: setRed, black: setBlack, odd: setOdd, even: setEven, over: setOver, under: setUnder }[kind];
    if (!setter) return;
    const old = { red, black, odd, even, over, under }[kind];
    setter(old + bet);
    setHistory((h) => [...h, { kind, old }]);
  }, [bet, inside, columns, dozens, red, black, odd, even, over, under, playSound]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    playSound(menuClickRef);
    const last = history[history.length - 1];
    if (last.kind === 'zero' || last.kind === 'straight' || last.kind === 'split-left' || last.kind === 'bottom' || last.kind === 'corner') {
      dispatchInside({ type: 'update', ind: last.ind ?? 0, val: last.old });
    } else if (last.kind === 'column') dispatchColumns({ type: 'update', ind: last.target, val: last.old });
    else if (last.kind === 'dozen') dispatchDozens({ type: 'update', ind: last.target, val: last.old });
    else {
      const setter = { red: setRed, black: setBlack, odd: setOdd, even: setEven, over: setOver, under: setUnder }[last.kind];
      setter?.(last.old);
    }
    setHistory((h) => h.slice(0, -1));
  }, [history, playSound]);

  const clearBets = useCallback(() => {
    playSound(menuClickRef);
    setRed(0); setBlack(0); setOdd(0); setEven(0); setOver(0); setUnder(0);
    dispatchDozens({ type: 'reset' }); dispatchColumns({ type: 'reset' }); dispatchInside({ type: 'reset' });
    setHistory([]); setWarning('');
  }, [playSound]);

  const total = red + black + odd + even + over + under + dozens.reduce((s, v) => s + v, 0) + columns.reduce((s, v) => s + v, 0) + inside.reduce((s, v) => s + v, 0);

  // Translate the table state into the real contract's (betType, selection, numbers)
  // bets — this is the only place the felt layout ever touches chain logic.
  const buildBets = useCallback(() => {
    const bets = [];
    if (red > 0) bets.push({ betType: 1, selection: 0, amount: red });
    if (black > 0) bets.push({ betType: 1, selection: 1, amount: black });
    if (even > 0) bets.push({ betType: 2, selection: 0, amount: even });
    if (odd > 0) bets.push({ betType: 2, selection: 1, amount: odd });
    if (under > 0) bets.push({ betType: 3, selection: 0, amount: under });
    if (over > 0) bets.push({ betType: 3, selection: 1, amount: over });
    dozens.forEach((amount, index) => { if (amount > 0) bets.push({ betType: 4, selection: index, amount }); });
    // UI column index 0 sits at the top of the felt (numbers …,33,36 — contract
    // selection 2); index 2 sits at the bottom next to zero (selection 0).
    columns.forEach((amount, index) => { if (amount > 0) bets.push({ betType: 5, selection: 2 - index, amount }); });
    inside.forEach((amount, index) => {
      if (amount <= 0) return;
      if (index === 0) { bets.push({ betType: 0, selection: 0, amount }); return; }
      const position = ((index - 1) % 4) + 1;
      const n = Math.floor((index - 1) / 4) + 1;
      if (position === 1) bets.push({ betType: 0, selection: n, amount });
      else if (position === 2) { const pair = SPLIT_LEFT[n]; if (pair) bets.push({ betType: 6, numbers: pair, amount }); }
      else if (position === 3) {
        if (BOTTOM_ROW.has(n)) bets.push({ betType: 6, numbers: [n, n + 1, n + 2], amount });
        else { const pair = BOTTOM_SPLIT[n]; if (pair) bets.push({ betType: 6, numbers: pair, amount }); }
      } else if (position === 4) { const quad = CORNER[n]; if (quad) bets.push({ betType: 6, numbers: quad, amount }); }
    });
    return bets;
  }, [red, black, odd, even, over, under, dozens, columns, inside]);

  async function lockBet() {
    if (total <= 0 || hook.busy) return;
    const bets = buildBets();
    if (bets.length > 10) { setWarning('Too many distinct bets on the table (max 10) — remove some before spinning.'); return; }
    setWarning('');
    playSound(spinSoundRef);
    setRoundDismissed(false);
    const response = hook.mode === 'treasury'
      ? await hook.playTreasury({ bets: bets.map((b) => ({ betType: b.betType, selection: b.selection ?? 0, numbers: b.numbers ?? [], wagerRaw: Math.round(b.amount * 10 ** USDC_DECIMALS) })) })
      : await hook.playBets(bets.map((b) => ({ betType: b.betType, selection: b.selection ?? 0, numbers: b.numbers ?? [], amount: String(b.amount) })));
    if (!response) { setRoundDismissed(true); return; }
    const winningNumber = Number(response.outcome.winningNumber);
    const payout = Number(response.payout ?? 0);
    setRecentResults((prev) => [winningNumber, ...prev].slice(0, 12));
    setRounds((prev) => [...prev, { number: winningNumber, wager: total, payout }].slice(-50));
    if (payout > 0) playSound(winSoundRef);
  }

  const winningNumber = hook.stage === 'done' && !roundDismissed ? Number(hook.outcome?.winningNumber) : null;

  return (
    <ThemeProvider theme={theme}>
      <Box className="site-game-page" sx={{ bgcolor: '#080005' }}>
        <audio ref={spinSoundRef} src="/sounds/ball-spin.mp3" preload="auto" />
        <audio ref={winSoundRef} src="/sounds/win-chips.mp3" preload="auto" />
        <audio ref={chipSelectRef} src="/sounds/chip-select.mp3" preload="auto" />
        <audio ref={chipPlaceRef} src="/sounds/chip-put.mp3" preload="auto" />
        <audio ref={menuClickRef} src="/sounds/menu.mp3" preload="auto" />
        <audio ref={backgroundMusicRef} src="/sounds/background-music.mp3" preload="auto" loop />
        <audio ref={ambientSoundsRef} src="/sounds/ambient-sounds.mp3" preload="auto" loop />

        <RouletteHeader />

        <Box sx={{ position: 'fixed', top: 15, right: 15, zIndex: 100 }}>
          <IconButton
            onClick={() => setIsMuted((m) => !m)}
            aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
            sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
          >
            {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
          </IconButton>
        </Box>

        <Box className="site-page-pad-x" sx={{ width: '100%', maxWidth: { md: 1680, lg: 1800 }, mx: { md: 'auto' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
            <BalanceChip treasury={hook.treasury} />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', overflowX: 'auto', py: 0.75, mb: 2, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2, gap: 1 }}>
            <Typography variant="body2" sx={{ mx: 1.5, whiteSpace: 'nowrap', color: '#fff', fontWeight: 700 }}>Recent:</Typography>
            {recentResults.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', opacity: 0.8 }}>No spins yet</Typography>
            ) : recentResults.map((n, i) => (
              <Box key={i} sx={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', flexShrink: 0, bgcolor: n === 0 ? 'game.green' : RED_SET.has(n) ? 'game.red' : 'dark.bg', border: '1px solid rgba(255,255,255,0.2)' }}>{n}</Box>
            ))}
          </Box>

          {/* The felt — 14-column grid: zero, three number thirds, the 2-to-1 rail. */}
          <Box sx={{ width: '100%', overflowX: 'auto', overflowY: 'visible', pb: 1 }}>
            <Box sx={{ minWidth: { xs: 760, md: 980 } }}>
              <Grid container columns={14} sx={{ mt: 1.5, '& .MuiTypography-h5': { fontSize: { xs: '1rem', md: '1.2rem' } } }}>
                <Grid xs={1}>
                  <GridZero amount={inside[0]} isWinner={winningNumber === 0} placeBet={placeBet} />
                </Grid>
                <Grid xs={4} container columns={12}>
                  {firstThird.map((v, i) => (
                    <Grid xs={3} key={`f-${v.val}`}>
                      <GridInside
                        insideNumber={v.val} red={v.red} topEdge={i < 4} placeBet={placeBet}
                        straightup={inside[(v.val - 1) * 4 + 1]} splitleft={inside[(v.val - 1) * 4 + 2]}
                        splitbottom={inside[(v.val - 1) * 4 + 3]} corner={inside[(v.val - 1) * 4 + 4]}
                        hasCorner={Boolean(CORNER[v.val])} isWinner={winningNumber === v.val}
                      />
                    </Grid>
                  ))}
                </Grid>
                <Grid xs={4} container columns={12}>
                  {secondThird.map((v, i) => (
                    <Grid xs={3} key={`s-${v.val}`}>
                      <GridInside
                        insideNumber={v.val} red={v.red} topEdge={i < 4} placeBet={placeBet}
                        straightup={inside[(v.val - 1) * 4 + 1]} splitleft={inside[(v.val - 1) * 4 + 2]}
                        splitbottom={inside[(v.val - 1) * 4 + 3]} corner={inside[(v.val - 1) * 4 + 4]}
                        hasCorner={Boolean(CORNER[v.val])} isWinner={winningNumber === v.val}
                      />
                    </Grid>
                  ))}
                </Grid>
                <Grid xs={4} container columns={12}>
                  {thirdThird.map((v, i) => (
                    <Grid xs={3} key={`t-${v.val}`}>
                      <GridInside
                        insideNumber={v.val} red={v.red} topEdge={i < 4} placeBet={placeBet}
                        straightup={inside[(v.val - 1) * 4 + 1]} splitleft={inside[(v.val - 1) * 4 + 2]}
                        splitbottom={inside[(v.val - 1) * 4 + 3]} corner={inside[(v.val - 1) * 4 + 4]}
                        hasCorner={Boolean(CORNER[v.val])} isWinner={winningNumber === v.val}
                      />
                    </Grid>
                  ))}
                </Grid>
                <Grid xs={1} sx={{ display: 'flex', alignItems: 'stretch' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
                    <GridColumnBet topCard index={0} amount={columns[0]} placeBet={placeBet} />
                    <GridColumnBet index={1} amount={columns[1]} placeBet={placeBet} />
                    <GridColumnBet bottomCard index={2} amount={columns[2]} placeBet={placeBet} />
                  </Box>
                </Grid>

                <Grid xs={1} />
                <Grid xs={4}>
                  <GridOutsideBet onClick={() => placeBet('dozen', 0)}>
                    <Typography variant="h5">1st 12</Typography>
                    {dozens[0] > 0 && <BetBox betValue={dozens[0]} betType="1st 12" onClick={() => placeBet('dozen', 0)} />}
                  </GridOutsideBet>
                </Grid>
                <Grid xs={4}>
                  <GridOutsideBet onClick={() => placeBet('dozen', 1)}>
                    <Typography variant="h5">2nd 12</Typography>
                    {dozens[1] > 0 && <BetBox betValue={dozens[1]} betType="2nd 12" onClick={() => placeBet('dozen', 1)} />}
                  </GridOutsideBet>
                </Grid>
                <Grid xs={4}>
                  <GridOutsideBet rightCard onClick={() => placeBet('dozen', 2)}>
                    <Typography variant="h5">3rd 12</Typography>
                    {dozens[2] > 0 && <BetBox betValue={dozens[2]} betType="3rd 12" onClick={() => placeBet('dozen', 2)} />}
                  </GridOutsideBet>
                </Grid>
                <Grid xs={1} sx={{ borderLeft: (t) => `10px solid ${t.palette.dark.card}` }} />

                <Grid xs={1} />
                <Grid xs={2}>
                  <GridOutsideBet onClick={() => placeBet('under')}>
                    <Typography variant="h5">1-18</Typography>
                    {under > 0 && <BetBox betValue={under} betType="Under (1-18)" onClick={() => placeBet('under')} />}
                  </GridOutsideBet>
                </Grid>
                <Grid xs={2}>
                  <GridOutsideBet onClick={() => placeBet('even')}>
                    <Typography variant="h5">Even</Typography>
                    {even > 0 && <BetBox betValue={even} betType="Even" onClick={() => placeBet('even')} />}
                  </GridOutsideBet>
                </Grid>
                <Grid xs={2}>
                  <GridOutsideBet onClick={() => placeBet('red')}>
                    <Box sx={{ width: 32, height: 32, bgcolor: 'game.red' }} />
                    {red > 0 && <BetBox betValue={red} betType="Red" onClick={() => placeBet('red')} />}
                  </GridOutsideBet>
                </Grid>
                <Grid xs={2}>
                  <GridOutsideBet onClick={() => placeBet('black')}>
                    <Box sx={{ width: 32, height: 32, bgcolor: 'dark.bg' }} />
                    {black > 0 && <BetBox betValue={black} betType="Black" onClick={() => placeBet('black')} />}
                  </GridOutsideBet>
                </Grid>
                <Grid xs={2}>
                  <GridOutsideBet onClick={() => placeBet('odd')}>
                    <Typography variant="h5">Odd</Typography>
                    {odd > 0 && <BetBox betValue={odd} betType="Odd" onClick={() => placeBet('odd')} />}
                  </GridOutsideBet>
                </Grid>
                <Grid xs={2}>
                  <GridOutsideBet rightCard onClick={() => placeBet('over')}>
                    <Typography variant="h5">19-36</Typography>
                    {over > 0 && <BetBox betValue={over} betType="Over (19-36)" onClick={() => placeBet('over')} />}
                  </GridOutsideBet>
                </Grid>
                <Grid xs={1} sx={{ borderLeft: (t) => `10px solid ${t.palette.dark.card}` }} />
              </Grid>
            </Box>
          </Box>

          <Typography variant="caption" sx={{ display: { xs: 'block', md: 'none' }, textAlign: 'center', mt: 1, opacity: 0.55 }}>
            Swipe left or right to view the full table
          </Typography>

          {/* Controls row — bet size, undo/clear, play mode, spin. */}
          <Box sx={{ mt: 2, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'flex-start' }, gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: { md: 260 } }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Chip value</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {QUICK_BETS.map((v) => (
                  <Box key={v} onClick={() => { setBet(v); playSound(chipSelectRef); }} sx={{ cursor: 'pointer', px: 1.5, py: 0.5, borderRadius: 999, fontWeight: 700, fontSize: 13, bgcolor: bet === v ? '#ffd54a' : 'rgba(255,255,255,0.06)', color: bet === v ? '#1a1a1a' : '#fff' }}>{v}</Box>
                ))}
              </Box>
              <PlayModeToggle mode={hook.mode} setMode={hook.setMode} disabled={hook.busy} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RouletteInfoTriggers activePanel={helpPanel} onOpen={setHelpPanel} />
              <RouletteInfoDialog panel={helpPanel} onClose={() => setHelpPanel(null)} onSwitchPanel={setHelpPanel} />
              <Tooltip title={<Typography>Undo last bet</Typography>}>
                <span><IconButton disabled={history.length === 0 || hook.busy} onClick={undo}><UndoIcon /></IconButton></span>
              </Tooltip>
              <Tooltip title={<Typography>Clear bets</Typography>}>
                <span><IconButton disabled={hook.busy} onClick={clearBets}><ClearIcon /></IconButton></span>
              </Tooltip>
            </Box>

            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: { xs: 'stretch', md: 'flex-end' }, gap: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Total on table: <b style={{ color: '#fff' }}>{total.toFixed(2)} USDC</b></Typography>
              {!hook.isConnected ? (
                <ConnectWalletButton className="w-full md:w-auto" />
              ) : winningNumber !== null ? (
                <Box sx={{ textAlign: { xs: 'center', md: 'right' } }}>
                  <Typography variant="h5">
                    Result: <span style={{ color: winningNumber === 0 ? '#14D854' : RED_SET.has(winningNumber) ? '#d82633' : '#fff' }}>{winningNumber}</span>
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Payout: {hook.payout} USDC</Typography>
                  {hook.settleHash && <a href={basescanUrl('tx', hook.settleHash)} target="_blank" rel="noreferrer" style={{ color: '#14D854', fontSize: 12 }}>View settlement on BaseScan ↗</a>}
                  <button type="button" onClick={() => setRoundDismissed(true)} className="mt-2 block w-full rounded-xl bg-white px-6 py-2 font-black text-black hover:bg-white/85">Play again</button>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>Your bets stay on the table</Typography>
                </Box>
              ) : (
                <button type="button" onClick={lockBet} disabled={total === 0 || hook.busy} className="rounded-xl bg-white px-7 py-3 font-black text-black transition hover:bg-white/85 disabled:cursor-wait disabled:opacity-50 w-full md:w-auto">
                  {hook.busy ? stageCopy[hook.stage] : total > 0 ? `Place Bet (${total.toFixed(2)} USDC)` : 'Place Bet'}
                </button>
              )}
              {warning && <Typography variant="body2" sx={{ color: '#fbbf24' }}>{warning}</Typography>}
              {hook.error && <Typography variant="body2" sx={{ color: '#f87171' }}>{hook.error}</Typography>}
            </Box>

            <Box sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}>
              <BettingStats rounds={rounds} />
            </Box>
          </Box>

          <Box sx={{ bgcolor: 'dark.card', borderRadius: 2, p: 2.5, mt: 3 }}>
            <Typography variant="body2" sx={{ color: '#f0abfc', fontWeight: 700, mb: 1 }}>Megapot progress</Typography>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800 }}>{hook.credits} <Typography component="span" sx={{ color: 'text.secondary', fontSize: 14 }}>/ 1000</Typography></Typography>
            <button
              disabled={!hook.vaultConfigured || !hook.canClaim || hook.claimPending || hook.claimReceiptLoading}
              onClick={() => hook.claim({ address: hook.rewardVaultAddress, abi: hook.rewardVaultAbi, functionName: 'claimTicket' })}
              className="mt-3 w-full rounded-xl bg-fuchsia-500 px-4 py-3 text-sm font-black disabled:opacity-40 md:w-auto"
            >
              {hook.claimPending || hook.claimReceiptLoading ? 'Claiming…' : 'Claim Megapot ticket'}
            </button>
          </Box>

          <Box sx={{ mt: { xs: 5, md: 6 } }}>
            <RouletteGameIntro />
          </Box>

          <Grid id="strategy" container spacing={3} sx={{ mt: { xs: 5, md: 6 } }}>
            <Grid xs={12} md={7}><StrategyGuide /></Grid>
            <Grid xs={12} md={5}><WinProbabilities /></Grid>
          </Grid>

          <Box id="payouts" sx={{ mt: { xs: 5, md: 6 } }}>
            <RoulettePayout />
          </Box>

          <Grid id="history" container spacing={3} sx={{ mt: { xs: 5, md: 6 }, mb: { xs: 5, md: 6 } }}>
            <Grid xs={12} md={7}><RouletteHistory address={hook.address} stage={hook.stage} /></Grid>
            <Grid xs={12} md={5}><RouletteLeaderboard stage={hook.stage} /></Grid>
          </Grid>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
