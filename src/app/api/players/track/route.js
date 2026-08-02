import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { wallet } = await request.json().catch(() => ({}));
  if (!isValidWalletAddress(wallet)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const key = normalizeWallet(wallet);
  const now = new Date().toISOString();
  const { error } = await db
    .from('tracked_wallets')
    .upsert({ wallet: key, last_seen_at: now }, { onConflict: 'wallet', ignoreDuplicates: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
