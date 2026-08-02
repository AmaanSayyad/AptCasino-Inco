import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const { wallet, code, source } = body || {};
  if (!isValidWalletAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Missing referral code' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const refereeWallet = normalizeWallet(wallet);
  const { data: codeRow } = await db.from('referral_codes').select('wallet').eq('code', code).maybeSingle();
  if (!codeRow) return NextResponse.json({ error: 'Unknown referral code' }, { status: 404 });
  if (normalizeWallet(codeRow.wallet) === refereeWallet) {
    return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 });
  }

  const { data: existing } = await db.from('referrals').select('id').eq('referee_wallet', refereeWallet).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, alreadyAttributed: true });

  const { error } = await db.from('referrals').insert({
    referrer_wallet: normalizeWallet(codeRow.wallet),
    referee_wallet: refereeWallet,
    code,
    source: source ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
