/**
 * Guards src/lib/games/outcomeFromSeed.js against drifting from AptCasino.sol.
 *
 * The treasury answers plinko rounds and mines clicks from these derivations before
 * the settling block exists, so a mismatch would pay players the wrong amount. Every
 * vector below was captured from a REAL Base Sepolia round: the seed comes from the
 * settle/commitMines calldata, the expected values from the event the contract emitted.
 *
 *   node scripts/check-outcome-mirror.mjs
 */
import assert from 'node:assert/strict';
import { minePositions, minesPayout, maxPicksForBankroll, plinkoOutcome } from '../src/lib/games/outcomeFromSeed.js';

const PLINKO = [
  { seed: 81462089455147565414572998709344543511858350438157945503155697157199533112566n, risk: 1, rows: 8, wager: 100000n, bucket: 6, bps: 8000n, payout: 80000n },
  { seed: 99075298949328779000009199188692702754497983630006405333826064743198058826346n, risk: 1, rows: 8, wager: 100000n, bucket: 4, bps: 3500n, payout: 35000n },
  { seed: 98274176156269242217500608961992988884791699849312827923477051412001770443845n, risk: 2, rows: 16, wager: 1000000n, bucket: 5, bps: 5000n, payout: 500000n },
];

const MINES = [
  { seed: 49350161993794671718366086239300516045849499293322476923733686487120988077221n, mineCount: 5, positions: [20, 8, 17, 10, 15] },
  { seed: 84557356561518037765598432910318984742463229461165860130944810463790871067622n, mineCount: 3, positions: [16, 20, 10] },
  { seed: 47147758272784340843049703370664857527794138098984155346263032368729935588162n, mineCount: 3, positions: [16, 13, 22] },
];

for (const v of PLINKO) {
  const got = plinkoOutcome({ risk: v.risk, rows: v.rows, wager: v.wager, seed: v.seed });
  assert.equal(got.bucket, v.bucket, `plinko bucket for seed ${v.seed}`);
  assert.equal(got.multiplierBps, v.bps, `plinko multiplier for seed ${v.seed}`);
  assert.equal(got.payout, v.payout, `plinko payout for seed ${v.seed}`);
}

for (const v of MINES) {
  assert.deepEqual(minePositions(v.seed, v.mineCount), v.positions, `mine layout for seed ${v.seed}`);
}

// _minesPayout: 1 USDC, 5 mines, 1 pick -> 1.2125 USDC (the liability the contract
// reserved on a real session), and it must grow strictly with each further pick.
assert.equal(minesPayout(1_000_000n, 5, 1), 1_212_500n);
let previous = 0n;
for (let picks = 1; picks <= 20; picks += 1) {
  const payout = minesPayout(1_000_000n, 5, picks);
  assert.ok(payout > previous, `mines payout must grow at pick ${picks}`);
  previous = payout;
}

// The bankroll cap must never allow a pick the contract would revert on.
const bankroll = 32_000_000n;
const picks = maxPicksForBankroll(1_000_000n, 5, bankroll);
assert.ok(minesPayout(1_000_000n, 5, picks) <= bankroll, 'capped pick must fit the bankroll');
assert.ok(minesPayout(1_000_000n, 5, picks + 1) > bankroll, 'cap must be the largest pick that fits');
assert.equal(maxPicksForBankroll(1_000_000n, 5, 0n), 0, 'an empty bankroll allows no picks');

console.log(`ok — ${PLINKO.length} plinko rounds, ${MINES.length} mine layouts, payout/bankroll invariants`);
