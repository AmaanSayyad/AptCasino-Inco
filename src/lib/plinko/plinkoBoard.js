import { plinkoMultiplier } from '@/lib/inco/payoutMath';

/**
 * Peg-board geometry, ported from the original PlinkoGame's canvas layout math
 * (same constants/formulas). Unlike the original, bin multipliers here come
 * from the live AptCasino.sol contract's actual payout math (payoutMath.js),
 * not a client-side rigged weighting table — the real outcome bucket always
 * comes from the settled on-chain event, never a client-side pick.
 */
export const PLINKO_CANVAS_WIDTH = 800;
export const PLINKO_CANVAS_HEIGHT = 600;
export const PLINKO_PADDING_X = 52;
export const PLINKO_PADDING_TOP = 36;
export const PLINKO_PADDING_BOTTOM = 28;

const RISK_INDEX = { Low: 0, Medium: 1, High: 2 };

export function riskLabelToIndex(riskLevel) {
  return RISK_INDEX[riskLevel] ?? 1;
}

export function getPinDistanceX(rows, binCount) {
  const availableWidth = PLINKO_CANVAS_WIDTH - PLINKO_PADDING_X * 2;
  return rows === 16 ? (availableWidth / (binCount - 1)) * 1.05 : availableWidth / (binCount - 1);
}

export function getPinRadius(rows) {
  return Math.max(2, (24 - rows) / 2);
}

export function generatePins(rows) {
  const binCount = rows + 1;
  const pins = [];
  const pinsLastRowXCoords = [];
  let pegId = 0;
  const pinDistanceX = getPinDistanceX(rows, binCount);

  for (let row = 0; row < rows; row += 1) {
    const rowY = PLINKO_PADDING_TOP + ((PLINKO_CANVAS_HEIGHT - PLINKO_PADDING_TOP - PLINKO_PADDING_BOTTOM) / (rows - 1)) * row;
    const pinsInRow = row === rows - 1 ? binCount + 1 : 3 + row;
    const rowPaddingX = PLINKO_PADDING_X + ((PLINKO_CANVAS_WIDTH - PLINKO_PADDING_X * 2 - pinDistanceX * (pinsInRow - 1)) / 2);
    for (let col = 0; col < pinsInRow; col += 1) {
      const colX = rowPaddingX + pinDistanceX * col;
      pins.push({ id: pegId++, row, col, x: colX, y: rowY });
      if (row === rows - 1) pinsLastRowXCoords.push(colX);
    }
  }
  return { pins, pinsLastRowXCoords, binCount };
}

export function resolvePlinkoBoard(rows, riskLevel) {
  const risk = riskLabelToIndex(riskLevel);
  const { pins, pinsLastRowXCoords, binCount } = generatePins(rows);
  const multipliers = Array.from({ length: binCount }, (_, bucket) => `${plinkoMultiplier(risk, rows, bucket).toFixed(2)}x`);
  return { multipliers, binCount, pins, pinsLastRowXCoords };
}

export function binCenterX(binIndex, pinsLastRowXCoords) {
  return (pinsLastRowXCoords[binIndex] + pinsLastRowXCoords[binIndex + 1]) / 2;
}

/** Last peg row Y in canvas coords (bins sit just below). */
export function plinkoLastPinRowY(rows) {
  if (rows <= 1) return PLINKO_PADDING_TOP;
  return PLINKO_CANVAS_HEIGHT - PLINKO_PADDING_BOTTOM;
}
