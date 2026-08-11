import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveTreasurySession } from '@/lib/treasury/session';
import { revealMinesTileTreasury, revealMinesTilesTreasury, treasuryAddress } from '@/lib/treasury/signer';
import { awardMegapotCredits } from '@/lib/treasury/megapot';

export const dynamic = 'force-dynamic';

/**
 * A tile click used to cost a full block (~2s): send revealTile, wait for its receipt,
 * read the events. But the layout was already decided at commitMines and is stored with
 * the session, so the answer is known here immediately — the tx is still broadcast
 * (nonce-ordered ahead of the eventual cashOut, which is what actually pays out), we
 * just stop blocking the player on its block.
 *
 * Sessions started before the layout column existed fall back to the old awaited path.
 */
export async function POST(request) {
  const wallet = await resolveTreasurySession(request);
  if (!wallet) return NextResponse.json({ error: 'Missing or expired treasury session' }, { status: 401 });
  if (!treasuryAddress()) return NextResponse.json({ error: 'Treasury is not configured on the server.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const gameId = body?.gameId != null ? String(body.gameId) : null;
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });

  const tile = Number(body?.tile);
  if (!Number.isInteger(tile) || tile < 0 || tile > 24) return NextResponse.json({ error: 'Invalid tile' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  let { data: session } = await db
    .from('treasury_mines_sessions')
    .select('wallet, wager_raw, mine_positions, revealed_tiles, max_picks')
    .eq('game_id', gameId)
    .maybeSingle();
  // Layout migration not applied yet — the select itself fails on the unknown columns.
  if (!session) {
    ({ data: session } = await db.from('treasury_mines_sessions').select('wallet, wager_raw').eq('game_id', gameId).maybeSingle());
  }
  if (!session || session.wallet !== wallet) return NextResponse.json({ error: 'Not your session' }, { status: 403 });

  if (!session.mine_positions) return legacyReveal(db, { gameId, tile, wallet, session });

  const revealed = session.revealed_tiles ?? [];
  if (revealed.includes(tile)) return NextResponse.json({ error: 'Tile already revealed' }, { status: 400 });
  const hitMine = session.mine_positions.includes(tile);
  if (!hitMine && session.max_picks != null && revealed.length >= session.max_picks) {
    return NextResponse.json({
      error: `Table limit reached — the bankroll only backs ${session.max_picks} picks on this wager. Cash out to collect.`,
    }, { status: 409 });
  }

  let hash;
  try {
    ({ hash } = await revealMinesTileTreasury({ gameId: BigInt(gameId), tile }));
  } catch (revealError) {
    return NextResponse.json({ error: revealError instanceof Error ? revealError.message : 'Reveal failed.' }, { status: 502 });
  }

  if (hitMine) {
    await db.from('treasury_mines_sessions').delete().eq('game_id', gameId);
    await Promise.all([
      awardMegapotCredits(db, wallet, session.wager_raw, 0).catch((megapotError) => console.error('megapot credit award failed', megapotError)),
      db.from('game_play_events').insert({
        chain: 'base-sepolia', game: 'mines', wallet, bet_raw: session.wager_raw, payout_raw: 0, currency: 'USDC',
        result: 'Hit a mine', fairness_proof: { gameId, tile, engine: 'inco-lightning', mode: 'treasury' }, proof_reference: hash,
      }),
    ]);
    return NextResponse.json({ ok: true, hitMine: true, minePositions: session.mine_positions, revealedTiles: [], hash });
  }

  const nextRevealed = [...revealed, tile];
  await db.from('treasury_mines_sessions').update({ revealed_tiles: nextRevealed }).eq('game_id', gameId);
  return NextResponse.json({
    ok: true,
    hitMine: false,
    minePositions: null,
    revealedCount: nextRevealed.length,
    revealedTiles: [tile],
    picksLeft: session.max_picks == null ? null : session.max_picks - nextRevealed.length,
    hash,
  });
}

/** Pre-layout sessions: read the result off the reveal tx's receipt, as before. */
async function legacyReveal(db, { gameId, tile, wallet, session }) {
  let result;
  try {
    result = await revealMinesTilesTreasury({ gameId: BigInt(gameId), tiles: [tile] });
  } catch (revealError) {
    return NextResponse.json({ error: revealError instanceof Error ? revealError.message : 'Reveal failed.' }, { status: 502 });
  }
  if (result.hitMine) {
    await db.from('treasury_mines_sessions').delete().eq('game_id', gameId);
    await awardMegapotCredits(db, wallet, session.wager_raw, 0).catch((megapotError) => console.error('megapot credit award failed', megapotError));
    await db.from('game_play_events').insert({
      chain: 'base-sepolia', game: 'mines', wallet, bet_raw: session.wager_raw, payout_raw: 0, currency: 'USDC',
      result: 'Hit a mine', fairness_proof: { gameId, tile, engine: 'inco-lightning', mode: 'treasury' }, proof_reference: result.hash,
    });
  }
  return NextResponse.json({
    ok: true,
    hitMine: result.hitMine,
    minePositions: result.minePositions ?? null,
    revealedCount: result.revealedCount ?? null,
    revealedTiles: result.revealedTiles ?? (result.hitMine ? [] : [tile]),
    hash: result.hash,
  });
}
