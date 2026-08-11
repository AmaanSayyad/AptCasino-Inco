import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** Returns the wallet that referred this player (if any) — used for Megapot inviter split. */
export async function GET(request) {
  const wallet = new URL(request.url).searchParams.get('wallet');
  if (!isValidWalletAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 });
  }
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ inviter: null });

  const { data } = await db
    .from('referrals')
    .select('referrer_wallet')
    .eq('referee_wallet', normalizeWallet(wallet))
    .maybeSingle();

  return NextResponse.json({ inviter: data?.referrer_wallet || null });
}
