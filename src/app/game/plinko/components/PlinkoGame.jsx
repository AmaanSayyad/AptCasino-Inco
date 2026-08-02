'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PLINKO_CANVAS_HEIGHT,
  PLINKO_CANVAS_WIDTH,
  binCenterX,
  getPinDistanceX,
  getPinRadius,
  plinkoLastPinRowY,
  resolvePlinkoBoard,
} from '@/lib/plinko/plinkoBoard';
import { formatUnits } from 'viem';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';

/**
 * Board rendering ported from the original PlinkoGame's canvas/SVG layout
 * (same geometry, multiplier-slot placement, bet-history sidebar, audio cues).
 * The original drove the ball with a real matter-js physics simulation whose
 * final bin was pre-selected client-side; that dependency isn't available
 * here (see report), so the ball animates on a simple deterministic path
 * instead — but critically, the landing bucket is ALWAYS the real on-chain
 * `outcome.bucket` from useConfidentialGame, never client-picked.
 */
export default function PlinkoGame({ rowCount, riskLevel, busy, stage, outcome, recentBets = [] }) {
  const board = useMemo(() => resolvePlinkoBoard(rowCount, riskLevel), [rowCount, riskLevel]);
  const { multipliers, pins, pinsLastRowXCoords } = board;
  const pinDistanceX = useMemo(() => getPinDistanceX(rowCount, board.binCount), [rowCount, board.binCount]);
  const pinRadius = getPinRadius(rowCount);

  const [ballY, setBallY] = useState(0);
  const [ballX, setBallX] = useState(PLINKO_CANVAS_WIDTH / 2);
  const [landedBin, setLandedBin] = useState(null);
  const rafRef = useRef(null);
  const ballDropAudioRef = useRef(null);
  const binLandAudioRef = useRef(null);

  const multiplierSlotLayout = useMemo(() => {
    const lastPinY = plinkoLastPinRowY(rowCount);
    const slotTopPct = ((lastPinY + pinRadius * 2 + 6) / PLINKO_CANVAS_HEIGHT) * 100;
    const slotWidthPct = (pinDistanceX / PLINKO_CANVAS_WIDTH) * 100 * 0.92;
    return multipliers.map((_, index) => ({
      leftPct: (binCenterX(index, pinsLastRowXCoords) / PLINKO_CANVAS_WIDTH) * 100,
      widthPct: slotWidthPct,
      topPct: slotTopPct,
    }));
  }, [multipliers, pinsLastRowXCoords, pinDistanceX, rowCount, pinRadius]);

  useEffect(() => {
    if (!busy) return undefined;
    setLandedBin(null);
    const startX = PLINKO_CANVAS_WIDTH / 2;
    const start = performance.now();
    const wobble = (Math.random() - 0.5) * pinDistanceX * 3;
    const play = (ref) => { try { ref.current && (ref.current.currentTime = 0, ref.current.play().catch(() => {})); } catch {} };
    play(ballDropAudioRef);

    function frame(now) {
      const t = Math.min(1, (now - start) / 1400);
      setBallY(t * plinkoLastPinRowY(rowCount));
      setBallX(startX + wobble * t + Math.sin(t * 18) * pinDistanceX * 0.35 * (1 - t));
      if (t < 1 && stage !== 'done') rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [busy, rowCount, pinDistanceX, stage]);

  useEffect(() => {
    if (stage !== 'done' || outcome?.bucket == null) return;
    const bucket = Number(outcome.bucket);
    const centerX = binCenterX(bucket, pinsLastRowXCoords);
    setBallX(centerX);
    setBallY(plinkoLastPinRowY(rowCount));
    setLandedBin(bucket);
    try { binLandAudioRef.current && (binLandAudioRef.current.currentTime = 0, binLandAudioRef.current.play().catch(() => {})); } catch {}
  }, [stage, outcome, pinsLastRowXCoords, rowCount]);

  const recentBetSlots = useMemo(() => {
    const filled = recentBets.slice(0, 5);
    return { filled, emptyCount: Math.max(0, 5 - filled.length) };
  }, [recentBets]);

  function getSlotColor(index) {
    const total = multipliers.length;
    const center = Math.floor(total / 2);
    if (index === 0 || index === total - 1) return 'from-pink-500 to-red-500';
    if (index === center) return 'from-blue-500 to-purple-500';
    const ratio = Math.abs(index - center) / center;
    if (ratio > 0.7) return 'from-pink-500 to-purple-500';
    if (ratio > 0.4) return 'from-purple-500 to-blue-500';
    return 'from-blue-500 to-purple-500';
  }

  return (
    <div className="bg-[#1A0015] rounded-xl border border-[#333947] p-3 sm:p-6 overflow-hidden">
      <div className="relative bg-[#2A0025] rounded-lg p-3 sm:p-6 min-h-0 flex flex-col items-center">
        <p className="mb-3 w-full max-w-[800px] rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-center text-[10px] leading-snug text-amber-100/90 sm:text-xs">
          Bucket is settled on-chain by Inco Lightning — the board never picks its own winner.
        </p>
        <audio ref={ballDropAudioRef} src="/sounds/chip-put.mp3" preload="auto" />
        <audio ref={binLandAudioRef} src="/sounds/win-chips.mp3" preload="auto" />
        <div className="relative w-full max-w-[800px] min-w-0">
          <div className="relative w-full aspect-[4/3]">
            <svg className="absolute inset-0 h-full w-full z-10" viewBox={`0 0 ${PLINKO_CANVAS_WIDTH} ${PLINKO_CANVAS_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
              {pins.map((pin) => (
                <circle key={pin.id} cx={pin.x} cy={pin.y} r="6" fill="white" className="drop-shadow-sm" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
              ))}
              {busy && (
                <circle cx={ballX} cy={ballY} r={pinRadius * 2} fill="#ff6b6b" style={{ filter: 'drop-shadow(0 0 8px rgba(255, 107, 107, 0.9))' }} />
              )}
            </svg>
            <div className="pointer-events-none absolute inset-0 z-20">
              {multipliers.map((multiplier, index) => {
                const layout = multiplierSlotLayout[index];
                const isLanded = landedBin === index;
                return (
                  <div
                    key={index}
                    className={`absolute flex flex-col items-center text-center transition-all duration-300 ${isLanded ? 'font-bold text-yellow-400' : 'text-white'}`}
                    style={{ left: `${layout.leftPct}%`, top: `${layout.topPct}%`, width: `${layout.widthPct}%`, transform: isLanded ? 'translateX(-50%) scale(1.1)' : 'translateX(-50%)' }}
                  >
                    <div className={`flex w-full aspect-[10/7] max-h-8 items-center justify-center rounded bg-gradient-to-r ${getSlotColor(index)} shadow-lg sm:max-h-9 ${isLanded ? 'ring-2 ring-yellow-400' : ''}`}>
                      <span className="max-w-full truncate px-0.5 text-[7px] font-bold leading-none text-white sm:text-[9px] md:text-[10px]">{multiplier}</span>
                    </div>
                    <div className={`mt-0.5 h-0.5 w-full rounded-full sm:mt-1 sm:h-1 ${isLanded ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-[#333947]'}`} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hidden md:block absolute right-2 lg:right-4 top-4 z-30">
            <div className="space-y-2">
              {recentBetSlots.filled.map((bet, index) => (
                <div key={index} className="w-16 h-16 bg-[#2A0025] border border-[#333947] rounded-lg flex flex-col items-center justify-center p-1">
                  <span className="w-full text-center leading-tight text-xs font-bold text-white">{bet.multiplier}</span>
                  <span className={`w-full text-center leading-tight text-[10px] ${bet.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {bet.netPnl >= 0 ? '+' : ''}{bet.netPnl} USDC
                  </span>
                </div>
              ))}
              {Array.from({ length: recentBetSlots.emptyCount }).map((_, index) => (
                <div key={`empty-${index}`} className="w-16 h-16 bg-[#2A0025] border border-[#333947] rounded-lg flex items-center justify-center opacity-30">
                  <span className="text-xs text-gray-500">-</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 flex w-full gap-1.5 overflow-x-auto pb-2 scrollbar-thin md:hidden">
            {recentBetSlots.filled.map((bet, index) => (
              <div key={`m-${index}`} className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-[#333947] bg-[#2A0025] p-1">
                <span className="text-[10px] font-bold text-white">{bet.multiplier}</span>
                <span className={`text-[9px] ${bet.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{bet.netPnl >= 0 ? '+' : ''}{bet.netPnl}</span>
              </div>
            ))}
            {Array.from({ length: recentBetSlots.emptyCount }).map((_, index) => (
              <div key={`m-empty-${index}`} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#333947] bg-[#2A0025] opacity-30">
                <span className="text-xs text-gray-500">-</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function outcomeToBetSlot(outcome, wagerRaw) {
  const payout = Number(formatUnits(outcome.payout, USDC_DECIMALS));
  const wager = Number(formatUnits(wagerRaw, USDC_DECIMALS));
  const multiplier = wager > 0 ? `${(payout / wager).toFixed(2)}x` : '0x';
  return { multiplier, netPnl: (payout - wager).toFixed(4) };
}
