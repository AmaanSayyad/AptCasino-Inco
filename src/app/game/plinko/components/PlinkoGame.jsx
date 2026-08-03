'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Matter from 'matter-js';
import {
  PLINKO_CANVAS_HEIGHT,
  PLINKO_CANVAS_WIDTH,
  PLINKO_PADDING_TOP,
  PLINKO_PADDING_BOTTOM,
  binCenterX,
  getBallFrictions,
  getPinDistanceX,
  getPinRadius,
  plinkoLastPinRowY,
  resolvePlinkoBoard,
} from '@/lib/plinko/plinkoBoard';
import { formatUnits } from 'viem';
import { USDC_DECIMALS } from '@/lib/contracts/usdc';

const PIN_CATEGORY = 0x0001;
const BALL_CATEGORY = 0x0002;

/**
 * Board rendering ported from the original PlinkoGame's canvas/SVG layout
 * (same geometry, multiplier-slot placement, bet-history sidebar, audio cues).
 * The ball drop is now REAL matter-js physics (same engine/peg/wall setup the
 * original used) — genuine bounce off every peg, no scripted path.
 *
 * Safety property: the payout always comes from the real on-chain
 * `outcome.bucket`/multiplierBps (settled via Inco), never from wherever the
 * ball visually lands. The original itself worked the same way structurally —
 * it teleported the ball's X to the pre-chosen bin's center the instant it
 * reached the bottom sensor (`Matter.Body.setPosition`), rather than trusting
 * physics to land exactly in a bin. We reuse that exact snap-to-bin technique,
 * just feeding it the real settled bucket instead of the original's rigged
 * client-side pick (its own code comment: "~70% losing slots... not used for
 * payout" — i.e. the original's own RNG wasn't even how it decided who won).
 *
 * The drop only starts once the round is fully settled and the real bucket is
 * already known — waiting several seconds on Base/Inco with the ball just
 * sitting at the floor felt broken. So instead: show a clear "settling"
 * status while the on-chain round is in flight, then play one smooth
 * fall-and-land animation the instant the outcome arrives.
 */
export default function PlinkoGame({ rowCount, riskLevel, busy, stage, outcome, recentBets = [], stageLabel }) {
  const board = useMemo(() => resolvePlinkoBoard(rowCount, riskLevel), [rowCount, riskLevel]);
  const { multipliers, pins, pinsLastRowXCoords } = board;
  const pinDistanceX = useMemo(() => getPinDistanceX(rowCount, board.binCount), [rowCount, board.binCount]);
  const pinRadius = getPinRadius(rowCount);

  const [ballY, setBallY] = useState(0);
  const [ballX, setBallX] = useState(PLINKO_CANVAS_WIDTH / 2);
  const [ballVisible, setBallVisible] = useState(false);
  const [landedBin, setLandedBin] = useState(null);
  const engineRef = useRef(null);
  const ballRef = useRef(null);
  const rafRef = useRef(null);
  const restingRef = useRef(false);
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

  // (Re)build the physics world whenever the board geometry changes.
  useEffect(() => {
    const { Engine, World, Bodies } = Matter;
    if (engineRef.current) Engine.clear(engineRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    ballRef.current = null;
    setBallVisible(false);

    const engine = Engine.create({ gravity: { y: 1 } });
    engineRef.current = engine;

    const pegBodies = pins.map((pin) => Bodies.circle(pin.x, pin.y, pinRadius, {
      isStatic: true,
      restitution: 0.5,
      collisionFilter: { category: PIN_CATEGORY, mask: BALL_CATEGORY },
      render: { visible: false },
    }));

    const firstPinX = pins[0]?.x ?? PLINKO_CANVAS_WIDTH / 2;
    const lastRowFirstPinX = pinsLastRowXCoords[0] ?? firstPinX;
    const lastRowLastPinX = pinsLastRowXCoords[pinsLastRowXCoords.length - 1] ?? firstPinX;
    const boardHeight = PLINKO_CANVAS_HEIGHT - PLINKO_PADDING_TOP - PLINKO_PADDING_BOTTOM;
    const leftWallAngle = Math.atan2(firstPinX - lastRowFirstPinX, boardHeight);
    const rightWallAngle = Math.atan2(lastRowLastPinX - firstPinX, boardHeight);
    const leftWallX = lastRowFirstPinX - pinDistanceX * 0.5;
    const rightWallX = lastRowLastPinX + pinDistanceX * 0.5;

    const leftWall = Bodies.rectangle(leftWallX, PLINKO_CANVAS_HEIGHT / 2, 10, PLINKO_CANVAS_HEIGHT, {
      isStatic: true, angle: leftWallAngle, render: { visible: false },
    });
    const rightWall = Bodies.rectangle(rightWallX, PLINKO_CANVAS_HEIGHT / 2, 10, PLINKO_CANVAS_HEIGHT, {
      isStatic: true, angle: -rightWallAngle, render: { visible: false },
    });
    // A real floor (not just a sensor) so the ball actually rests at the bottom
    // while we wait for the on-chain settlement, instead of falling through.
    const floor = Bodies.rectangle(PLINKO_CANVAS_WIDTH / 2, plinkoLastPinRowY(rowCount) + pinRadius * 3, PLINKO_CANVAS_WIDTH * 2, 20, {
      isStatic: true, render: { visible: false },
    });

    World.add(engine.world, [...pegBodies, leftWall, rightWall, floor]);

    return () => { Engine.clear(engine); };
  }, [pins, pinsLastRowXCoords, pinDistanceX, pinRadius, rowCount]);

  // Drop a real ball the instant a NEW settled outcome arrives — not while the round is
  // still in flight. `handledOutcomeRef` tracks which outcome we've already animated for,
  // so this fires exactly once per round regardless of how many times `stage`/`outcome`
  // re-render while staying 'done'.
  const handledOutcomeRef = useRef(null);
  useEffect(() => {
    if (stage !== 'done' || outcome?.bucket == null || !engineRef.current) return undefined;
    if (handledOutcomeRef.current === outcome) return undefined;
    handledOutcomeRef.current = outcome;

    const { Bodies, World } = Matter;
    setLandedBin(null);
    restingRef.current = false;

    const firstRowPins = pins.filter((pin) => pin.row === 0);
    const firstRowCenterX = firstRowPins.length
      ? (firstRowPins[0].x + firstRowPins[firstRowPins.length - 1].x) / 2
      : PLINKO_CANVAS_WIDTH / 2;
    const startX = firstRowCenterX + (Math.random() - 0.5) * pinDistanceX * 0.8;
    const ballRadius = pinRadius * 2;
    const { friction, frictionAir } = getBallFrictions(rowCount);

    if (ballRef.current) World.remove(engineRef.current.world, ballRef.current);
    const ball = Bodies.circle(startX, 0, ballRadius, {
      restitution: 0.8,
      friction,
      frictionAir,
      collisionFilter: { category: BALL_CATEGORY, mask: PIN_CATEGORY },
    });
    ballRef.current = ball;
    World.add(engineRef.current.world, ball);
    setBallVisible(true);
    try { ballDropAudioRef.current && (ballDropAudioRef.current.currentTime = 0, ballDropAudioRef.current.play().catch(() => {})); } catch {}

    const bucket = Number(outcome.bucket);
    const centerX = binCenterX(bucket, pinsLastRowXCoords);
    const floorY = plinkoLastPinRowY(rowCount);
    function frame() {
      if (!engineRef.current || !ballRef.current) return;
      Matter.Engine.update(engineRef.current, 1000 / 60);
      const { x, y } = ballRef.current.position;
      if (y >= floorY - ballRadius && !restingRef.current) {
        // Physically rested — the real bucket is already known, so slide straight into
        // it (same snap-to-bin technique the original used) instead of a long idle wait.
        restingRef.current = true;
        Matter.Body.setPosition(ballRef.current, { x: centerX, y: floorY });
        setBallX(centerX);
        setBallY(floorY);
        setLandedBin(bucket);
        try { binLandAudioRef.current && (binLandAudioRef.current.currentTime = 0, binLandAudioRef.current.play().catch(() => {})); } catch {}
        return;
      }
      setBallX(x);
      setBallY(Math.min(y, floorY));
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [stage, outcome, rowCount, pinDistanceX, pinRadius, pins, pinsLastRowXCoords]);

  useEffect(() => () => { if (engineRef.current) Matter.Engine.clear(engineRef.current); }, []);

  // Clear the previous round's landed ball the moment a new one starts, so the board
  // reads as "waiting for this round" rather than showing stale results during the wait.
  useEffect(() => {
    if (busy) { setBallVisible(false); setLandedBin(null); }
  }, [busy]);

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
              {ballVisible && (
                <circle cx={ballX} cy={ballY} r={pinRadius * 2} fill="#ff6b6b" style={{ filter: 'drop-shadow(0 0 8px rgba(255, 107, 107, 0.9))' }} />
              )}
            </svg>
            {busy && !ballVisible && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#1A0015]/70">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-fuchsia-400" aria-hidden />
                <p className="text-xs font-semibold text-white/80">{stageLabel || 'Settling round…'}</p>
              </div>
            )}
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
