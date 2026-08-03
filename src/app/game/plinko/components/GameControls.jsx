'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { usdcAbi, usdcAddress, USDC_DECIMALS } from '@/lib/contracts/usdc';
import ConnectWalletButton from '@/components/ConnectWalletButton';

const RISK_LEVELS = ['Low', 'Medium', 'High'];
const ROW_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const QUICK_BET_PRESETS = [0.1, 0.5, 1, 5, 10];

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

/** Same on-win/on-loss increase control as wheel's BettingPanel — kept identical for consistency. */
function StrategyControl({ label, mode, onModeChange, percent, onPercentChange }) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-white/70">{label}</span>
      <div className="flex gap-1.5 p-1 rounded-lg bg-[#2A0025] border border-[#333947]/80">
        <button type="button" onClick={() => onModeChange('reset')} className={cn('flex-1 rounded-md py-2 text-xs font-medium transition-all', mode === 'reset' ? 'bg-gradient-to-r from-pink-500/90 to-purple-500/90 text-white shadow-sm' : 'text-white/45 hover:text-white/70')}>Reset bet</button>
        <button type="button" onClick={() => onModeChange('increase')} className={cn('flex-1 rounded-md py-2 text-xs font-medium transition-all', mode === 'increase' ? 'bg-gradient-to-r from-pink-500/90 to-purple-500/90 text-white shadow-sm' : 'text-white/45 hover:text-white/70')}>Increase</button>
      </div>
      {mode === 'increase' && (
        <div className="flex items-center gap-2 rounded-lg border border-[#333947]/80 bg-[#2A0025] px-3 py-2.5">
          <span className="text-xs text-white/45 shrink-0">By</span>
          <input type="number" min="0" max="1000" step="1" value={percent} onChange={(e) => onPercentChange(e.target.value)} className="w-full bg-transparent text-sm text-white outline-none tabular-nums" placeholder="0" />
          <span className="text-xs text-white/45 shrink-0">%</span>
        </div>
      )}
    </div>
  );
}

/**
 * Faithful port of the original's Manual/Auto GameControls — dropped the old
 * multi-chain currency switcher and the fake setInterval auto-loop (which just
 * replayed instant client-side outcomes). Auto mode now runs a real sequential
 * loop in page.jsx's autoBet() — each round fully settles on-chain (approve ->
 * play -> Inco reveal -> settle) before the next starts, same pattern as wheel.
 */
export default function GameControls({ wager, setWager, riskLevel, setRiskLevel, rows, setRows, onManualBet, onAutoBet, busy, stageLabel }) {
  const { address, isConnected } = useAccount();
  const [gameMode, setGameMode] = useState('manual');
  const [numberOfBets, setNumberOfBets] = useState(10);
  const [winMode, setWinMode] = useState('reset');
  const [lossMode, setLossMode] = useState('reset');
  const [winIncrease, setWinIncrease] = useState('0');
  const [lossIncrease, setLossIncrease] = useState('0');
  const [stopProfit, setStopProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [showRiskDropdown, setShowRiskDropdown] = useState(false);
  const [showRowsDropdown, setShowRowsDropdown] = useState(false);

  const balanceRead = useReadContract({
    address: usdcAddress, abi: usdcAbi, functionName: 'balanceOf', args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });
  const balance = balanceRead.data != null ? Number(formatUnits(balanceRead.data, USDC_DECIMALS)) : 0;

  const parsedBet = parseFloat(wager) || 0;
  const canBet = parsedBet > 0 && parsedBet <= balance && !busy;
  const applyBet = (next) => setWager(String(next));
  const handleMultiplier = (multiplier) => applyBet(Math.max(0, Math.min(balance, parsedBet * multiplier)).toFixed(2));

  const handleSubmit = () => {
    if (!canBet) return;
    if (gameMode === 'auto') {
      onAutoBet({
        numberOfBets,
        winIncrease: winMode === 'increase' ? Number(winIncrease) / 100 : 0,
        lossIncrease: lossMode === 'increase' ? Number(lossIncrease) / 100 : 0,
        stopProfit: parseFloat(stopProfit) || 0,
        stopLoss: parseFloat(stopLoss) || 0,
      });
    } else {
      onManualBet();
    }
  };

  const buttonLabel = busy ? (stageLabel || (gameMode === 'auto' ? 'Auto dropping…' : 'Dropping…')) : gameMode === 'auto' ? 'Start Autobet' : 'Drop Ball';

  return (
    <div className="flex flex-col rounded-xl border border-[#333947] bg-[#1A0015] p-4 space-y-4">
      <div className="flex rounded-lg border border-[#333947]/60 bg-[#2A0025] p-1">
        {['manual', 'auto'].map((mode) => (
          <button key={mode} type="button" onClick={() => setGameMode(mode)} className={cn('flex-1 rounded-md py-2 text-sm font-medium capitalize transition-all', gameMode === mode ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md' : 'text-white/40 hover:text-white/70')}>{mode}</button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-white/50 mb-1">
          <span>Bet Amount (USDC)</span>
          <span>Balance: {balance.toFixed(2)} USDC</span>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-[#333947]/80">
          <div className="flex flex-[3] items-center gap-2 bg-[#2A0025] px-3 py-2.5">
            <input type="number" step="0.1" min="0" value={wager} onChange={(e) => setWager(e.target.value)} disabled={busy} className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/25 disabled:opacity-50 tabular-nums" placeholder="1" />
            <span className="shrink-0 text-xs text-white/40">USDC</span>
          </div>
          <div className="flex flex-[2]">
            <button type="button" disabled={busy} onClick={() => handleMultiplier(0.5)} className="flex-1 border-l border-[#333947]/80 bg-[#420039] text-xs text-white transition-colors hover:bg-[#520049] disabled:opacity-50">½</button>
            <button type="button" disabled={busy} onClick={() => handleMultiplier(2)} className="flex-1 border-l border-[#333947]/80 bg-[#420039] text-xs text-white transition-colors hover:bg-[#520049] disabled:opacity-50">2×</button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1">
          {QUICK_BET_PRESETS.map((preset) => (
            <button key={preset} type="button" disabled={busy} onClick={() => applyBet(preset)} className={cn('rounded-lg border py-1.5 text-[10px] font-medium transition-colors disabled:opacity-50', Math.abs(parsedBet - preset) < 0.0001 ? 'border-pink-400/50 bg-pink-600/25 text-white' : 'border-[#333947]/50 bg-[#2A0025] text-white/60 hover:border-pink-500/30 hover:text-white')}>{preset}</button>
          ))}
        </div>
      </div>

      <div className="relative">
        <span className="mb-1 block text-xs font-medium text-white">Risk</span>
        <button onClick={() => setShowRiskDropdown((v) => !v)} disabled={busy} className="flex w-full items-center justify-between rounded-lg border border-[#333947] bg-[#2A0025] px-3 py-2.5 text-sm text-white disabled:opacity-50">
          {riskLevel} {showRiskDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showRiskDropdown && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#333947] bg-[#2A0025]">
            {RISK_LEVELS.map((level) => (
              <button key={level} onClick={() => { setRiskLevel(level); setShowRiskDropdown(false); }} className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-purple-900/30">{level}</button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <span className="mb-1 block text-xs font-medium text-white">Rows (8–16)</span>
        <button onClick={() => setShowRowsDropdown((v) => !v)} disabled={busy} className="flex w-full items-center justify-between rounded-lg border border-[#333947] bg-[#2A0025] px-3 py-2.5 text-sm text-white disabled:opacity-50">
          {rows} {showRowsDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showRowsDropdown && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#333947] bg-[#2A0025]">
            {ROW_OPTIONS.map((n) => (
              <button key={n} onClick={() => { setRows(n); setShowRowsDropdown(false); }} className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-purple-900/30">{n} rows</button>
            ))}
          </div>
        )}
      </div>

      {gameMode === 'auto' && (
        <div className="space-y-4 rounded-xl border border-[#333947]/50 bg-[#2A0025]/60 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">Auto session</p>
          <div>
            <label className="mb-2 block text-xs font-medium text-white/70">Number of bets</label>
            <input type="number" min="1" max="500" value={numberOfBets} disabled={busy} onChange={(e) => setNumberOfBets(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded-lg border border-[#333947]/80 bg-[#0A0009] px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500/40 disabled:opacity-50 tabular-nums" />
          </div>
          <StrategyControl label="On win" mode={winMode} onModeChange={setWinMode} percent={winIncrease} onPercentChange={setWinIncrease} />
          <StrategyControl label="On loss" mode={lossMode} onModeChange={setLossMode} percent={lossIncrease} onPercentChange={setLossIncrease} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-white/70">Stop on profit</label>
              <div className="flex items-center gap-2 rounded-lg border border-[#333947]/80 bg-[#0A0009] px-3 py-2.5">
                <input type="number" min="0" step="0.1" value={stopProfit} disabled={busy} onChange={(e) => setStopProfit(e.target.value)} placeholder="0" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25 disabled:opacity-50 tabular-nums" />
                <span className="text-[10px] text-white/40 shrink-0">USDC</span>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-white/70">Stop on loss</label>
              <div className="flex items-center gap-2 rounded-lg border border-[#333947]/80 bg-[#0A0009] px-3 py-2.5">
                <input type="number" min="0" step="0.1" value={stopLoss} disabled={busy} onChange={(e) => setStopLoss(e.target.value)} placeholder="0" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25 disabled:opacity-50 tabular-nums" />
                <span className="text-[10px] text-white/40 shrink-0">USDC</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] leading-relaxed text-white/35">Leave stop fields at 0 to disable. Each round settles fully on-chain before the next starts, so an auto session is slower than an instant simulation — that's the real confidential-compute round trip, not a bug.</p>
        </div>
      )}

      {!isConnected ? (
        <ConnectWalletButton className="w-full" />
      ) : (
        <div className="space-y-2">
          {!canBet && !busy && parsedBet > balance && <p className="text-center text-[11px] text-red-400/90">Insufficient USDC balance</p>}
          <button
            onClick={handleSubmit}
            disabled={!canBet}
            className={cn('w-full rounded-lg py-3 font-bold text-white shadow-lg shadow-purple-900/30 transition-all', canBet ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:brightness-110' : 'cursor-not-allowed bg-gray-700 text-white/40')}
          >
            {buttonLabel}
          </button>
        </div>
      )}
    </div>
  );
}
