import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loadBannedWalletKeys, filterBannedWalletRows } from '@/lib/bans/walletBan';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const limit = Math.min(Number(new URL(request.url).searchParams.get('limit')) || 50, 100);
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', leaderboard: [] }, { status: 503 });

  const [{ data, error }, banned] = await Promise.all([
    db.from('referral_leaderboard').select('*').order('rank', { ascending: true }).limit(limit),
    loadBannedWalletKeys(),
  ]);
  if (error) return NextResponse.json({ error: error.message, leaderboard: [] }, { status: 400 });

  return NextResponse.json({ leaderboard: filterBannedWalletRows(data ?? [], banned, (r) => r.wallet) });
}
