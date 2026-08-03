import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveTreasurySession } from '@/lib/treasury/session';
import { revealMinesTileTreasury, treasuryAddress } from '@/lib/treasury/signer';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const wallet = await resolveTreasurySession(request);
  if (!wallet) return NextResponse.json({ error: 'Missing or expired treasury session' }, { status: 401 });
  if (!treasuryAddress()) return NextResponse.json({ error: 'Treasury is not configured on the server.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const gameId = body?.gameId != null ? String(body.gameId) : null;
  const tile = Number(body?.tile);
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
  if (!Number.isInteger(tile) || tile < 0 || tile > 24) return NextResponse.json({ error: 'Invalid tile' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data: session } = await db.from('treasury_mines_sessions').select('wallet, wager_raw').eq('game_id', gameId).maybeSingle();
  if (!session || session.wallet !== wallet) return NextResponse.json({ error: 'Not your session' }, { status: 403 });

  let result;
  try {
    result = await revealMinesTileTreasury({ gameId: BigInt(gameId), tile });
  } catch (revealError) {
    return NextResponse.json({ error: revealError instanceof Error ? revealError.message : 'Reveal failed.' }, { status: 502 });
  }

  if (result.hitMine) {
    await db.from('treasury_mines_sessions').delete().eq('game_id', gameId);
    await db.from('game_play_events').insert({
      chain: 'base-sepolia', game: 'mines', wallet, bet_raw: session.wager_raw, payout_raw: 0, currency: 'USDC',
      result: 'Hit a mine', fairness_proof: { gameId, tile, engine: 'inco-lightning', mode: 'treasury' }, proof_reference: result.hash,
    });
  }

  return NextResponse.json({ ok: true, hitMine: result.hitMine, minePositions: result.minePositions ?? null, revealedCount: result.revealedCount ?? null, hash: result.hash });
}
