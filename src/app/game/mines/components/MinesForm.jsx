'use client';

import { useRef, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { FaDice, FaRobot, FaCoins, FaInfoCircle, FaArrowRight, FaBomb } from 'react-icons/fa';
import { minesStageCopy } from '@/lib/inco/useMinesSession';
import { usdcAbi, usdcAddress, USDC_DECIMALS } from '@/lib/contracts/usdc';
import BalanceChip from '@/components/treasury/BalanceChip';
import PlayModeToggle from '@/components/treasury/PlayModeToggle';
import AIAutoBetting from './AIAutoBetting';

const MAX_MINES = 10; // matches MinesBoard's ladder cap — AptCasino.sol itself allows up to 24.
const QUICK_BET_PRESETS = [0.1, 0.5, 1, 5, 10, 100];

/** The left-column betting form — ported from the original's Form.jsx (card header,
 * Manual/Auto tabs, bet-amount + mines-count fields, big gradient submit button). Wired
 * to the real `useMinesSession` hook instead of the original's local `betSettings` +
 * client-simulated grid. */
export default function MinesForm({ gameHook, session }) {
  const [tab, setTab] = useState('manual');
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const { address } = useAccount();
  const balanceRead = useReadContract({
    address: usdcAddress, abi: usdcAbi, functionName: 'balanceOf', args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });
  const balance = balanceRead.data != null ? Number(formatUnits(balanceRead.data, USDC_DECIMALS)) : 0;
  const wagerValue = parseFloat(session.wager) || 0;

  const busy = ['approving', 'betting', 'revealing', 'settling'].includes(session.stage);
  const isBusy = session.active || busy;
  const isAuto = tab === 'auto';

  async function handleStart(e) {
    e.preventDefault();
    if (isBusy) return;
    await session.start();
  }

  return (
    <div className="w-full">
      {/* Tab switcher — a standalone pill bar above the form, matching the original's
          generic <Tabs> component (which wraps a separate DynamicForm per tab) rather
          than living inside the form card below. */}
      <div className="mb-2 flex items-center justify-center gap-4 rounded-3xl border-2 border-gray-800 bg-[#09011C] p-2">
        <button type="button" onClick={() => setTab('manual')} className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition-all ${!isAuto ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md' : 'text-white/45 hover:text-white/70'}`}>Manual</button>
        <button type="button" onClick={() => setTab('auto')} className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition-all ${isAuto ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-white/45 hover:text-white/70'}`}>Auto</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-purple-800/25 bg-[#0f0612]/90 shadow-lg">
        <div className="border-b border-purple-900/25 bg-gradient-to-r from-[#1a0818]/80 to-[#120610]/80 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg border p-2 ${isAuto ? 'border-blue-500/25 bg-blue-500/10' : 'border-purple-500/25 bg-purple-500/10'}`}>
              {isAuto ? <FaRobot className="text-sm text-blue-400" /> : <FaDice className="text-sm text-purple-400" />}
            </div>
            <div>
              <h3 className="text-base font-semibold leading-tight text-white">{isAuto ? 'Auto Betting' : 'Manual Betting'}</h3>
              <p className="mt-0.5 text-xs text-white/45">{isAuto ? 'Runs multiple rounds with stop limits' : 'Pick tiles yourself each round'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <BalanceChip treasury={gameHook.treasury} />
          <PlayModeToggle mode={session.mode} setMode={session.setMode} disabled={session.active} />

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-purple-500/25 bg-purple-500/10 p-1.5"><FaDice className="text-xs text-purple-400" /></div>
            <div>
              <p className="text-sm font-semibold text-white">Game settings</p>
              <p className="text-[11px] text-white/45">Bet size and mine count</p>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-white/60">Bet Amount (USDC)</label>
              <span className="text-[11px] tabular-nums text-white/45">Balance {balance.toFixed(4)} USDC</span>
            </div>
            <div className="flex gap-0">
              <div className="magic-gradient flex-[3] rounded-l-lg p-0.5">
                <div className="flex items-center rounded-[7px] bg-gradient-to-br from-[#190026]/95 to-[#0D0015]/95 px-3 py-2.5">
                  <input
                    type="number" min="0.1" max="10" step="0.1"
                    className="w-full bg-transparent text-sm font-medium text-white outline-none disabled:opacity-50" value={session.wager}
                    onChange={(e) => session.setWager(e.target.value)}
                    disabled={session.active}
                  />
                </div>
              </div>
              <div className="flex flex-[2]">
                <button type="button" disabled={session.active} onClick={() => session.setWager(String(Math.max(0.1, wagerValue / 2)))} className="flex-1 border border-l-0 border-purple-800/40 bg-[#2a1030] text-xs text-white transition-colors hover:bg-[#3a1540] disabled:opacity-50">½</button>
                <button type="button" disabled={session.active} onClick={() => session.setWager(String(wagerValue * 2 || 0.1))} className="flex-1 rounded-r-lg border border-l-0 border-purple-800/40 bg-[#2a1030] text-xs text-white transition-colors hover:bg-[#3a1540] disabled:opacity-50">2×</button>
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {QUICK_BET_PRESETS.map((amount) => (
                <button key={amount} type="button" disabled={session.active} onClick={() => session.setWager(String(amount))} className={`rounded-lg border py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${Math.abs(wagerValue - amount) < 0.0000001 ? 'border-purple-400/60 bg-purple-600/25 text-white' : 'border-purple-800/30 bg-black/20 text-white/70 hover:border-purple-600/40 hover:text-white'}`}>{amount} USDC</button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-white/60">Number of Mines</label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-red-400"><FaBomb /></div>
              <div className="magic-gradient rounded-lg p-0.5">
                <select
                  className="w-full appearance-none rounded-[7px] bg-gradient-to-br from-[#190026]/90 to-[#0D0015]/90 py-3 pl-11 pr-4 text-sm font-medium text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  value={session.mineCount} disabled={session.active}
                  onChange={(e) => session.setMineCount(Number(e.target.value))}
                >
                  {Array.from({ length: MAX_MINES }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? 'Mine' : 'Mines'}</option>)}
                </select>
              </div>
            </div>
          </div>

        {isAuto ? (
          <AIAutoBetting sessionRef={sessionRef} mode={session.mode} mineCount={session.mineCount} disabled={session.active} />
        ) : !gameHook.isConnected ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-center text-xs text-amber-200/90">Connect your wallet to play.</p>
        ) : (
          <button
            type="button" onClick={handleStart} disabled={isBusy}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-all ${isBusy ? 'cursor-not-allowed bg-gray-800 opacity-60' : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-purple-900/25'}`}
          >
            {isBusy ? (
              <>{session.active ? 'Round in progress…' : `${minesStageCopy[session.stage]}…`}</>
            ) : (
              <><FaCoins className="text-xs" /> START GAME <FaArrowRight className="text-xs opacity-80" /></>
            )}
          </button>
        )}

        <div className="flex gap-2.5 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5">
          <FaInfoCircle className="mt-0.5 shrink-0 text-xs text-blue-400/70" />
          <p className="text-[11px] leading-relaxed text-white/50">
            {isAuto
              ? 'Auto mode places bets, reveals a fixed number of tiles, then cashes out each round — every step is a real on-chain transaction settled through Inco.'
              : 'Click tiles to reveal gems and raise your multiplier. Cash out anytime before hitting a mine.'}
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
