import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveTreasurySession } from '@/lib/treasury/session';
import { startAndCommitMines, treasuryAddress } from '@/lib/treasury/signer';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const wallet = await resolveTreasurySession(request);
  if (!wallet) return NextResponse.json({ error: 'Missing or expired treasury session' }, { status: 401 });
  if (!treasuryAddress()) return NextResponse.json({ error: 'Treasury is not configured on the server.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const mineCount = Number(body?.mineCount);
  const wagerRaw = Number(body?.wagerRaw);
  if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) return NextResponse.json({ error: 'Invalid mine count' }, { status: 400 });
  if (!Number.isInteger(wagerRaw) || wagerRaw <= 0) return NextResponse.json({ error: 'Invalid wager' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const { data: afterDebit, error: debitError } = await db.rpc('treasury_debit', { p_wallet: wallet, p_amount: wagerRaw });
  if (debitError) return NextResponse.json({ error: debitError.message }, { status: 400 });
  if (afterDebit === null) return NextResponse.json({ error: 'Insufficient treasury balance' }, { status: 400 });
  await db.from('treasury_ledger').insert({ wallet, kind: 'wager', amount_raw: -wagerRaw, game: 'mines' });

  let session;
  try {
    session = await startAndCommitMines({ mineCount, wager: BigInt(wagerRaw) });
  } catch (startError) {
    await db.rpc('treasury_credit', { p_wallet: wallet, p_amount: wagerRaw });
    await db.from('treasury_ledger').insert({ wallet, kind: 'payout', amount_raw: wagerRaw, game: 'mines' });
    return NextResponse.json({ error: startError instanceof Error ? startError.message : 'Could not start the round.' }, { status: 502 });
  }

  const gameId = session.gameId.toString();
  // mine_positions stays server-side — it is what lets /reveal answer a click without
  // waiting for a block, and it must never be sent to the player.
  // ponytail: if 20260812000000_treasury_mines_layout.sql hasn't been applied yet the
  // insert fails on the unknown columns — fall back to a legacy row so the round still
  // plays (reveal detects the missing layout and waits on receipts, as it used to).
  const { error: insertError } = await db.from('treasury_mines_sessions').insert({
    game_id: gameId,
    wallet,
    wager_raw: wagerRaw,
    mine_positions: session.minePositions,
    max_picks: session.maxPicks,
  });
  if (insertError) {
    console.error('mines layout columns unavailable, storing legacy session', insertError.message);
    await db.from('treasury_mines_sessions').insert({ game_id: gameId, wallet, wager_raw: wagerRaw });
  }

  return NextResponse.json({
    ok: true,
    gameId,
    balanceRaw: afterDebit,
    startHash: session.startHash,
    commitHash: session.commitHash,
    maxPicks: session.maxPicks,
  });
}
