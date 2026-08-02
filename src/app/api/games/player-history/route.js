import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
  if (!isValidWalletAddress(wallet)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.', history: [] }, { status: 503 });

  const { data, error } = await db
    .from('game_play_events')
    .select('id, game, bet_raw, payout_raw, currency, result, proof_reference, created_at')
    .eq('wallet', normalizeWallet(wallet))
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message, history: [] }, { status: 400 });
  return NextResponse.json({ history: data ?? [] });
}
