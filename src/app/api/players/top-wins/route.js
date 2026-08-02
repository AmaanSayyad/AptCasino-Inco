import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loadBannedWalletKeys, filterBannedWalletRows } from '@/lib/bans/walletBan';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const limit = Math.min(Number(new URL(request.url).searchParams.get('limit')) || 20, 100);
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', wins: [] }, { status: 503 });

  const [{ data, error }, banned] = await Promise.all([
    db
      .from('game_play_events')
      .select('wallet, game, bet_raw, payout_raw, currency, created_at')
      .gt('payout_raw', 0)
      .order('payout_raw', { ascending: false })
      .limit(500),
    loadBannedWalletKeys(),
  ]);
  if (error) return NextResponse.json({ error: error.message, wins: [] }, { status: 400 });

  return NextResponse.json({ wins: filterBannedWalletRows(data ?? [], banned, (r) => r.wallet).slice(0, limit) });
}
