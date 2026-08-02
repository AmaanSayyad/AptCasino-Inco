import { NextResponse } from 'next/server';
import { getSupabaseAdmin, normalizeWallet } from '@/lib/supabase/admin';
import { loadBannedWalletKeys, filterBannedWalletRows } from '@/lib/bans/walletBan';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');
  const game = searchParams.get('game');
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', history: [] }, { status: 503 });

  let query = db
    .from('game_play_events')
    .select('id, wallet, game, bet_raw, payout_raw, currency, result, proof_reference, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (wallet) query = query.eq('wallet', normalizeWallet(wallet));
  if (game && game !== 'all') query = query.eq('game', game);

  const [{ data, error }, banned] = await Promise.all([query, loadBannedWalletKeys()]);
  if (error) return NextResponse.json({ error: error.message, history: [] }, { status: 400 });
  return NextResponse.json({ history: filterBannedWalletRows(data ?? [], banned, (r) => r.wallet) });
}
