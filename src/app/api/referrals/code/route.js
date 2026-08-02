import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidWalletAddress, normalizeWallet } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomCode(length = 7) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export async function GET(request) {
  const wallet = new URL(request.url).searchParams.get('wallet');
  if (!isValidWalletAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 });

  const key = normalizeWallet(wallet);
  const { data: existing } = await db.from('referral_codes').select('code').eq('wallet', key).maybeSingle();
  if (existing) return NextResponse.json({ code: existing.code });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    const { data, error } = await db
      .from('referral_codes')
      .insert({ code, wallet: key })
      .select('code')
      .single();
    if (!error) return NextResponse.json({ code: data.code });
    if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: 'Could not allocate a referral code, try again.' }, { status: 500 });
}
