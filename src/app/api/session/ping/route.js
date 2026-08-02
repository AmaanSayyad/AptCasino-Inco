import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { wallet, sessionId } = await request.json().catch(() => ({}));
  if (!isValidWalletAddress(wallet)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const now = new Date().toISOString();
  if (sessionId) {
    const { error } = await db.from('user_sessions').update({ last_ping_at: now }).eq('id', sessionId).is('ended_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, sessionId });
  }

  const { data, error } = await db
    .from('user_sessions')
    .insert({ wallet_address: normalizeWallet(wallet), chain: 'base-sepolia' })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, sessionId: data.id });
}
