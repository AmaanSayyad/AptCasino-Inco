import { NextResponse } from 'next/server';
import { createPublicClient, fallback, http, parseEventLogs } from 'viem';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';
import { APTCASINO_CHAIN, BASE_SEPOLIA_RPC_URLS } from '@/lib/baseSepolia';
import { aptCasinoAbi, aptCasinoAddress } from '@/lib/contracts/aptCasino';

export const dynamic = 'force-dynamic';

const GAMES = ['roulette', 'wheel', 'plinko', 'mines'];
const KIND_TO_GAME = ['roulette', 'wheel', 'plinko', 'mines'];
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

const publicClient = createPublicClient({
  chain: APTCASINO_CHAIN,
  transport: fallback(BASE_SEPOLIA_RPC_URLS.map((url) => http(url, { retryCount: 2, timeout: 15_000 })), { rank: false }),
});

function summarize(game, outcomeArgs) {
  if (game === 'roulette') return `Landed on ${outcomeArgs.winningNumber}`;
  if (game === 'wheel') return `Segment ${outcomeArgs.segment} · ${(Number(outcomeArgs.multiplierBps) / 10_000).toFixed(2)}x`;
  if (game === 'plinko') return `Bucket ${outcomeArgs.bucket} · ${(Number(outcomeArgs.multiplierBps) / 10_000).toFixed(2)}x`;
  return outcomeArgs.hitMine ? 'Hit a mine' : 'Cleared the board';
}

const OUTCOME_EVENTS = { roulette: 'RouletteOutcome', wheel: 'WheelOutcome', plinko: 'PlinkoOutcome', mines: 'MinesOutcome' };

/**
 * Logs a settled confidential round for history/leaderboard display. The bet/payout
 * amounts and outcome are read back from the on-chain BetSettled + outcome events for
 * `txHash` rather than trusted from the request body — this is a display-only record
 * (see the fairness_proof column comment), but it should still reflect what actually
 * happened on-chain, not whatever a client claims happened.
 */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const { wallet, game, txHash } = body || {};
  if (!isValidWalletAddress(wallet)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  if (!GAMES.includes(game)) return NextResponse.json({ error: 'Invalid game' }, { status: 400 });
  if (!TX_HASH_RE.test(txHash || '')) return NextResponse.json({ error: 'Invalid transaction hash' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return NextResponse.json({ error: 'Settlement transaction not found' }, { status: 404 });
  }
  if (receipt.to?.toLowerCase() !== aptCasinoAddress.toLowerCase() || receipt.status !== 'success') {
    return NextResponse.json({ error: 'Not a successful AptCasino settlement transaction' }, { status: 400 });
  }

  const [settled] = parseEventLogs({ abi: aptCasinoAbi, eventName: 'BetSettled', logs: receipt.logs });
  if (!settled || normalizeWallet(settled.args.player) !== normalizeWallet(wallet)) {
    return NextResponse.json({ error: 'BetSettled event missing or wallet mismatch' }, { status: 400 });
  }
  if (KIND_TO_GAME[Number(settled.args.kind)] !== game) {
    return NextResponse.json({ error: 'Game/kind mismatch' }, { status: 400 });
  }
  const [outcome] = parseEventLogs({ abi: aptCasinoAbi, eventName: OUTCOME_EVENTS[game], logs: receipt.logs });
  if (!outcome) return NextResponse.json({ error: 'Outcome event missing' }, { status: 400 });

  const outcomeArgs = JSON.parse(JSON.stringify(outcome.args, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));

  const { error } = await db.from('game_play_events').insert({
    chain: 'base-sepolia',
    game,
    wallet: normalizeWallet(wallet),
    bet_raw: Number(settled.args.wager),
    payout_raw: Number(settled.args.payout),
    currency: 'USDC',
    result: summarize(game, outcomeArgs),
    fairness_proof: { gameId: settled.args.gameId.toString(), outcome: outcomeArgs, engine: 'inco-lightning' },
    proof_reference: txHash,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
