import { wheelMultiplier } from '@/lib/inco/payoutMath';

export type WheelSegment = { multiplier: number; probability: number; color: string };

export const SEGMENT_OPTIONS = [10, 20, 30, 40] as const;
export const RISK_LABELS = ['low', 'medium', 'high'] as const;

function riskIndex(risk: string): number {
  return risk === 'high' ? 2 : risk === 'low' ? 0 : 1;
}

/**
 * Segment layout/colors, but the multiplier per segment is read straight from
 * the live AptCasino.sol contract's math (via payoutMath.js) — not the
 * original UI's own probability table — so the wheel never displays a
 * multiplier the contract wouldn't actually pay out.
 */
export function buildExpandedWheelSegments(risk: string, noOfSegments: number): WheelSegment[] {
  const segments = Math.max(2, Math.min(50, Math.floor(noOfSegments) || 10));
  const idx = riskIndex(risk);
  const prob = 1 / segments;
  const arr: WheelSegment[] = [];
  for (let i = 0; i < segments; i += 1) {
    const multiplier = wheelMultiplier(idx, i, segments);
    arr.push({ multiplier, probability: prob, color: colorForMultiplier(idx, multiplier) });
  }
  return arr;
}

const COLOR_TIERS: Record<number, string[]> = {
  0: ['#333947', '#00E403', '#FDE905'],
  1: ['#333947', '#00E403', '#FCA32F', '#D72E60'],
  2: ['#333947', '#7F46FD', '#D72E60'],
};

function colorForMultiplier(riskIdx: number, multiplier: number): string {
  if (multiplier === 0) return '#333947';
  const tiers = COLOR_TIERS[riskIdx] || COLOR_TIERS[1];
  if (riskIdx === 0) return multiplier >= 2 ? tiers[2] : tiers[1];
  if (riskIdx === 2) return multiplier >= 10 ? tiers[2] : tiers[1];
  return multiplier >= 5 ? tiers[3] : multiplier >= 2 ? tiers[2] : tiers[1];
}

export function wheelPanelMultipliers(risk: string, noOfSegments: number): number[] {
  const wheel = buildExpandedWheelSegments(risk, noOfSegments);
  return Array.from(new Set(wheel.map((d) => d.multiplier))).sort((a, b) => a - b);
}

export function wheelPanelColorMap(risk: string, noOfSegments: number): Record<number, string> {
  const wheel = buildExpandedWheelSegments(risk, noOfSegments);
  return Object.fromEntries(wheel.map((d) => [d.multiplier, d.color]));
}

export function getWheelSegmentAt(risk: string, noOfSegments: number, segmentIndex: number): WheelSegment {
  const wheel = buildExpandedWheelSegments(risk, noOfSegments);
  const idx = ((segmentIndex % wheel.length) + wheel.length) % wheel.length;
  return wheel[idx] ?? { multiplier: 0, probability: 0, color: '#333947' };
}

/** Which segment index sits under the top pointer for a given wheel rotation. */
export function segmentIndexUnderPointer(wheelPosition: number, segmentCount: number): number {
  const segments = Math.max(1, segmentCount);
  const segmentAngle = (Math.PI * 2) / segments;
  const normalized = ((wheelPosition % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const wheelAngle = (normalized - Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
  return Math.floor(wheelAngle / segmentAngle) % segments;
}

/** Wheel rotation (radians) that places `segmentIndex` center under the top pointer. */
export function wheelRotationForSegmentIndex(segmentIndex: number, segmentCount: number): number {
  const segments = Math.max(1, segmentCount);
  const segmentAngle = (Math.PI * 2) / segments;
  const idx = ((segmentIndex % segments) + segments) % segments;
  const center = idx * segmentAngle + segmentAngle / 2;
  return center + Math.PI / 2;
}
