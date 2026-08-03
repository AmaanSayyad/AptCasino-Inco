import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveTreasurySession } from '@/lib/treasury/session';
import { cashOutMinesTreasury, treasuryAddress } from '@/lib/treasury/signer';
import { summarizeOutcome } from '@/lib/games/summarize';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const wallet = await resolveTreasurySession(request);
  if (!wallet) return NextResponse.json({ error: 'Missing or expired treasury session' }, { status: 401 });
  if (!treasuryAddress()) return NextResponse.json({ error: 'Treasury is not configured on the server.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const gameId = body?.gameId != null ? String(body.gameId) : null;
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data: session } = await db.from('treasury_mines_sessions').select('wallet, wager_raw').eq('game_id', gameId).maybeSingle();
  if (!session || session.wallet !== wallet) return NextResponse.json({ error: 'Not your session' }, { status: 403 });

  let result;
  try {
    result = await cashOutMinesTreasury({ gameId: BigInt(gameId) });
  } catch (cashOutError) {
    return NextResponse.json({ error: cashOutError instanceof Error ? cashOutError.message : 'Cash out failed.' }, { status: 502 });
  }

  await db.from('treasury_mines_sessions').delete().eq('game_id', gameId);
  const payoutRaw = Number(result.payout);
  const { data: newBalance } = await db.rpc('treasury_credit', { p_wallet: wallet, p_amount: payoutRaw });
  await db.from('treasury_ledger').insert({ wallet, kind: 'payout', amount_raw: payoutRaw, game: 'mines' });
  await db.from('game_play_events').insert({
    chain: 'base-sepolia', game: 'mines', wallet, bet_raw: session.wager_raw, payout_raw: payoutRaw, currency: 'USDC',
    result: summarizeOutcome('mines', { hitMine: false }), fairness_proof: { gameId, engine: 'inco-lightning', mode: 'treasury' }, proof_reference: result.hash,
  });

  return NextResponse.json({ ok: true, payoutRaw, balanceRaw: newBalance, hash: result.hash });
}
