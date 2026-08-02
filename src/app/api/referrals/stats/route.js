import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const wallet = new URL(request.url).searchParams.get('wallet');
  if (!isValidWalletAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const key = normalizeWallet(wallet);
  const [{ data: codeRow }, { data: referrals }] = await Promise.all([
    db.from('referral_codes').select('code').eq('wallet', key).maybeSingle(),
    db.from('referrals').select('is_valid, referrer_reward_raw, attributed_at').eq('referrer_wallet', key),
  ]);

  const rows = referrals ?? [];
  return NextResponse.json({
    wallet: key,
    code: codeRow?.code ?? null,
    totalReferrals: rows.length,
    validReferrals: rows.filter((r) => r.is_valid).length,
    earnedRaw: rows.reduce((sum, r) => sum + Number(r.referrer_reward_raw || 0), 0).toString(),
  });
}
