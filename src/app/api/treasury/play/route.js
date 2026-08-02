import { NextResponse } from 'next/server';
import { getSupabaseAdmin, normalizeWallet } from '@/lib/supabase/admin';
import { resolveTreasurySession } from '@/lib/treasury/session';
import { playAndSettle, treasuryAddress } from '@/lib/treasury/signer';
import { summarizeOutcome } from '@/lib/games/summarize';

export const dynamic = 'force-dynamic';

const PLAY_FUNCTIONS = { roulette: 'playRoulette', wheel: 'playWheel', plinko: 'playPlinko', mines: 'playMines' };

/**
 * Builds the on-chain call args server-side from a request body — never trusts a
 * client-supplied function name/arg list directly, since this route spends the
 * treasury's own real USDC/ETH. Mirrors AptCasino.sol's own input checks so bad
 * requests fail here instead of burning gas on a guaranteed revert.
 */
function buildCall(game, body) {
  if (game === 'roulette') {
    const bets = Array.isArray(body.bets) ? body.bets : [];
    if (bets.length === 0 || bets.length > 10) throw new Error('Roulette needs 1-10 bets');
    const rawBets = bets.map((bet) => {
      const betType = Number(bet.betType);
      const selection = Number(bet.selection);
      const wager = BigInt(bet.wagerRaw);
      if (!Number.isInteger(betType) || betType < 0 || betType > 5) throw new Error('Invalid bet type');
      if (wager <= 0n) throw new Error('Invalid bet wager');
      return { betType, selection, wager };
    });
    const totalWager = rawBets.reduce((sum, bet) => sum + bet.wager, 0n);
    return { functionName: 'playRoulette', args: [rawBets], wager: totalWager };
  }
  if (game === 'wheel') {
    const risk = Number(body.risk);
    const segments = Number(body.segments);
    const wager = BigInt(body.wagerRaw);
    if (![0, 1, 2].includes(risk)) throw new Error('Invalid risk');
    if (![10, 20, 30, 40].includes(segments)) throw new Error('Invalid segments');
    if (wager <= 0n) throw new Error('Invalid wager');
    return { functionName: 'playWheel', args: [risk, segments, wager], wager };
  }
  if (game === 'plinko') {
    const risk = Number(body.risk);
    const rows = Number(body.rows);
    const wager = BigInt(body.wagerRaw);
    if (![0, 1, 2].includes(risk)) throw new Error('Invalid risk');
    if (!Number.isInteger(rows) || rows < 8 || rows > 16) throw new Error('Invalid rows');
    if (wager <= 0n) throw new Error('Invalid wager');
    return { functionName: 'playPlinko', args: [risk, rows, wager], wager };
  }
  if (game === 'mines') {
    const selectedTiles = Array.isArray(body.selectedTiles) ? body.selectedTiles.map(Number) : [];
    const mineCount = Number(body.mineCount);
    const wager = BigInt(body.wagerRaw);
    if (selectedTiles.length === 0 || selectedTiles.length > 10) throw new Error('Pick 1-10 tiles');
    if (new Set(selectedTiles).size !== selectedTiles.length) throw new Error('Duplicate tile selection');
    if (selectedTiles.some((tile) => tile < 0 || tile > 24)) throw new Error('Invalid tile index');
    if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 10) throw new Error('Invalid mine count');
    if (selectedTiles.length + mineCount > 25) throw new Error('Tiles + mines exceed the board');
    if (wager <= 0n) throw new Error('Invalid wager');
    return { functionName: 'playMines', args: [selectedTiles, mineCount, wager], wager };
  }
  throw new Error('Unknown game');
}

export async function POST(request) {
  const wallet = await resolveTreasurySession(request);
  if (!wallet) return NextResponse.json({ error: 'Missing or expired treasury session' }, { status: 401 });
  if (!treasuryAddress()) return NextResponse.json({ error: 'Treasury is not configured on the server.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const game = body?.game;
  if (!PLAY_FUNCTIONS[game]) return NextResponse.json({ error: 'Invalid game' }, { status: 400 });

  let call;
  try {
    call = buildCall(game, body);
  } catch (validationError) {
    return NextResponse.json({ error: validationError.message }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const wagerRaw = Number(call.wager);
  const { data: afterDebit, error: debitError } = await db.rpc('treasury_debit', { p_wallet: wallet, p_amount: wagerRaw });
  if (debitError) return NextResponse.json({ error: debitError.message }, { status: 400 });
  if (afterDebit === null) return NextResponse.json({ error: 'Insufficient treasury balance' }, { status: 400 });
  await db.from('treasury_ledger').insert({ wallet, kind: 'wager', amount_raw: -wagerRaw, game });

  let round;
  try {
    round = await playAndSettle({ game, functionName: call.functionName, args: call.args, wager: call.wager });
  } catch (playError) {
    // The round never (or never fully) settled — give the wager back.
    await db.rpc('treasury_credit', { p_wallet: wallet, p_amount: wagerRaw });
    await db.from('treasury_ledger').insert({ wallet, kind: 'payout', amount_raw: wagerRaw, game });
    return NextResponse.json({ error: playError instanceof Error ? playError.message : 'The round could not be completed.' }, { status: 502 });
  }

  const payoutRaw = Number(round.payout);
  let newBalance = afterDebit;
  if (payoutRaw > 0) {
    const { data } = await db.rpc('treasury_credit', { p_wallet: wallet, p_amount: payoutRaw });
    newBalance = data ?? newBalance;
    await db.from('treasury_ledger').insert({ wallet, kind: 'payout', amount_raw: payoutRaw, game });
  }

  const outcomeArgs = JSON.parse(JSON.stringify(round.outcome, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
  await db.from('game_play_events').insert({
    chain: 'base-sepolia',
    game,
    wallet,
    bet_raw: wagerRaw,
    payout_raw: payoutRaw,
    currency: 'USDC',
    result: summarizeOutcome(game, outcomeArgs),
    fairness_proof: { gameId: round.gameId.toString(), outcome: outcomeArgs, engine: 'inco-lightning', mode: 'treasury' },
    proof_reference: round.settleHash,
  });

  return NextResponse.json({
    ok: true,
    balanceRaw: newBalance,
    playHash: round.playHash,
    settleHash: round.settleHash,
    outcome: outcomeArgs,
    payoutRaw,
  });
}
