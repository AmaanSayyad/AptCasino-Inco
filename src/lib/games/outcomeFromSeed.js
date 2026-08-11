/**
 * Mirrors the parts of AptCasino.sol that turn an Inco-attested seed into a result.
 *
 * Why this exists: the treasury already holds the attested seed *before* it broadcasts
 * `settle`/`commitMines`, and both derivations are pure functions of that seed. Deriving
 * them here lets a round answer the player as soon as the seed is known instead of
 * waiting for the settlement block — the on-chain tx still runs and stays the source of
 * truth for money movement, this only removes it from the critical path.
 *
 * Keep byte-for-byte in sync with AptCasino.sol:
 *   _settlePlinko / _plinkoMultiplier  -> plinkoOutcome
 *   commitMines' Fisher-Yates loop     -> minePositions
 *   _minesPayout                       -> minesPayout
 */
import { encodeAbiParameters, keccak256 } from 'viem';

/** AptCasino.sol `_plinkoMultiplier` — basis points, integer math. */
export function plinkoMultiplierBps(risk, rows, bucket) {
  const center = Math.floor(rows / 2);
  const distance = bucket > center ? bucket - center : center - bucket;
  if (risk === 0) return distance >= center ? 40_000 : distance + 1 >= center ? 20_000 : distance >= 2 ? 11_000 : 7_000;
  if (risk === 1) return distance >= center ? 80_000 : distance + 1 >= center ? 30_000 : distance >= 2 ? 8_000 : 3_500;
  return distance >= center ? 160_000 : distance + 1 >= center ? 50_000 : distance >= 2 ? 5_000 : 1_000;
}

/** AptCasino.sol `_settlePlinko`: bucket = popcount of the low `rows` seed bits. */
export function plinkoOutcome({ risk, rows, wager, seed }) {
  let bucket = 0;
  for (let i = 0; i < rows; i += 1) bucket += Number((seed >> BigInt(i)) & 1n);
  const multiplierBps = BigInt(plinkoMultiplierBps(risk, rows, bucket));
  const maxPayout = wager * 16n;
  let payout = (wager * multiplierBps) / 10_000n;
  if (payout > maxPayout) payout = maxPayout; // settle() clamps the same way
  return { bucket, multiplierBps, payout };
}

/** AptCasino.sol `commitMines`: partial Fisher-Yates over a 0..24 pool. */
export function minePositions(seed, mineCount) {
  const pool = Array.from({ length: 25 }, (_, i) => i);
  const positions = [];
  for (let i = 0; i < mineCount; i += 1) {
    const hash = keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'uint8' }], [seed, i]));
    const j = i + Number(BigInt(hash) % BigInt(25 - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    positions.push(pool[i]);
  }
  return positions;
}

/** AptCasino.sol `_minesPayout` — integer math, so BigInt all the way. */
export function minesPayout(wager, mines, picks) {
  let numerator = 1n;
  let denominator = 1n;
  for (let i = 0; i < picks; i += 1) {
    numerator *= BigInt(25 - i);
    denominator *= BigInt(25 - mines - i);
  }
  return (wager * numerator * 97n) / (denominator * 100n);
}

/**
 * Largest pick count whose projected payout the bankroll can still reserve.
 * revealTile() reverts with InsufficientBankroll past this point, so the session
 * has to stop the player here rather than let a tile reveal fail on-chain.
 */
export function maxPicksForBankroll(wager, mines, availableBankroll) {
  let picks = 0;
  while (picks < 25 - mines && minesPayout(wager, mines, picks + 1) <= availableBankroll) picks += 1;
  return picks;
}
