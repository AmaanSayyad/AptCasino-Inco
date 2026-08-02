'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { usdcAbi, usdcAddress, USDC_DECIMALS } from '@/lib/contracts/usdc';
import ConnectWalletButton from '@/components/ConnectWalletButton';

const RISK_LEVELS = ['Low', 'Medium', 'High'];
const ROW_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

export default function GameControls({ wager, setWager, riskLevel, setRiskLevel, rows, setRows, onBet, busy, stageLabel }) {
  const { address, isConnected } = useAccount();
  const [showRiskDropdown, setShowRiskDropdown] = useState(false);
  const [showRowsDropdown, setShowRowsDropdown] = useState(false);

  const balanceRead = useReadContract({
    address: usdcAddress, abi: usdcAbi, functionName: 'balanceOf', args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });
  const balance = balanceRead.data != null ? Number(formatUnits(balanceRead.data, USDC_DECIMALS)) : 0;

  const betValue = parseFloat(wager) || 0;
  const setBetAmount = (v) => setWager(String(Math.max(0, v)));

  return (
    <div className="bg-[#1A0015] rounded-xl border border-[#333947] p-4 space-y-4">
      <div>
        <div className="flex items-center justify-between text-xs text-white/50 mb-1">
          <span>Bet Amount (USDC)</span>
          <span>Balance: {balance.toFixed(2)} USDC</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setBetAmount(betValue / 2)} className="rounded-lg border border-[#333947] bg-[#2A0025] px-2 py-2 text-white/70 hover:text-white"><Minus size={14} /></button>
          <input
            type="number" min="0.1" max="10" step="0.1" value={wager}
            onChange={(e) => setWager(e.target.value)}
            className="w-full rounded-lg border border-[#333947] bg-[#2A0025] px-3 py-2 text-center text-white"
          />
          <button onClick={() => setBetAmount(betValue * 2)} className="rounded-lg border border-[#333947] bg-[#2A0025] px-2 py-2 text-white/70 hover:text-white"><Plus size={14} /></button>
        </div>
      </div>

      <div className="relative">
        <span className="mb-1 block text-xs text-white/50">Risk</span>
        <button onClick={() => setShowRiskDropdown((v) => !v)} className="flex w-full items-center justify-between rounded-lg border border-[#333947] bg-[#2A0025] px-3 py-2 text-white">
          {riskLevel} {showRiskDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showRiskDropdown && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#333947] bg-[#2A0025]">
            {RISK_LEVELS.map((level) => (
              <button key={level} onClick={() => { setRiskLevel(level); setShowRiskDropdown(false); }} className="block w-full px-3 py-2 text-left text-white hover:bg-purple-900/30">{level}</button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <span className="mb-1 block text-xs text-white/50">Rows</span>
        <button onClick={() => setShowRowsDropdown((v) => !v)} className="flex w-full items-center justify-between rounded-lg border border-[#333947] bg-[#2A0025] px-3 py-2 text-white">
          {rows} {showRowsDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showRowsDropdown && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#333947] bg-[#2A0025]">
            {ROW_OPTIONS.map((n) => (
              <button key={n} onClick={() => { setRows(n); setShowRowsDropdown(false); }} className="block w-full px-3 py-2 text-left text-white hover:bg-purple-900/30">{n} rows</button>
            ))}
          </div>
        )}
      </div>

      {!isConnected ? (
        <ConnectWalletButton className="w-full" />
      ) : (
        <button
          onClick={onBet}
          disabled={busy || betValue <= 0}
          className="w-full rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 py-3 font-bold text-white shadow-lg shadow-purple-900/30 disabled:cursor-wait disabled:opacity-50"
        >
          {busy ? stageLabel : 'Drop Ball'}
        </button>
      )}
    </div>
  );
}
