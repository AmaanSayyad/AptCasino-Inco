/**
 * Mirrors the payout math in contracts/contracts/AptCasino.sol so the UI can
 * show accurate multiplier/odds tables without an extra chain read. Keep in
 * sync with the Solidity source if the contract's constants ever change.
 */

export function wheelMultiplier(risk, segment, segments) {
  const lane = Math.floor((segment * 10) / segments);
  if (risk === 0) return lane < 2 ? 2.0 : lane < 6 ? 1.1 : lane < 9 ? 0.8 : 0;
  if (risk === 1) return lane === 0 ? 5.0 : lane < 3 ? 2.0 : lane < 7 ? 0.75 : 0;
  return lane === 0 ? 10.0 : lane < 2 ? 3.0 : lane < 5 ? 0.5 : 0;
}

export function plinkoMultiplier(risk, rows, bucket) {
  const center = Math.floor(rows / 2);
  const distance = bucket > center ? bucket - center : center - bucket;
  if (risk === 0) return distance >= center ? 4.0 : distance + 1 >= center ? 2.0 : distance >= 2 ? 1.1 : 0.7;
  if (risk === 1) return distance >= center ? 8.0 : distance + 1 >= center ? 3.0 : distance >= 2 ? 0.8 : 0.35;
  return distance >= center ? 16.0 : distance + 1 >= center ? 5.0 : distance >= 2 ? 0.5 : 0.1;
}

export function minesMultiplier(mineCount, picks) {
  let numerator = 1;
  let denominator = 1;
  for (let i = 0; i < picks; i += 1) {
    numerator *= 25 - i;
    denominator *= 25 - mineCount - i;
  }
  return (numerator / denominator) * 0.97;
}

export const ROULETTE_PAYOUT = {
  straight: 36 * 0.97,
  dozenOrColumn: 3 * 0.97,
  evenMoney: 2 * 0.97,
};

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export function isRedNumber(n) {
  return RED_NUMBERS.has(n);
}
